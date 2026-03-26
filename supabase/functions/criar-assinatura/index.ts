// supabase/functions/criar-assinatura/index.ts
//
// Responsabilidades:
//   1. Cria (ou recupera) o cliente no Asaas
//   2. Cria a assinatura recorrente (cartão, Pix ou boleto)
//   3. Devolve a URL de pagamento para o front-end redirecionar
//
// Chamada pelo painel do prestador quando ele clica em "Assinar Pro".
//
// POST { billing_type: 'CREDIT_CARD' | 'PIX' | 'BOLETO' }
// Header: Authorization: Bearer <supabase-jwt>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// URL alternada pelo secret ASAAS_SANDBOX — nunca hardcode
const ASAAS_URL = Deno.env.get("ASAAS_SANDBOX") === "true"
  ? "https://sandbox.asaas.com/api/v3"
  : "https://api.asaas.com/v3";

const PLANOS = {
  pro:   { valor: 39.00, descricao: "AgendaPro Pro — mensal" },
  anual: { valor: 29.00, descricao: "AgendaPro Anual — 12x" }, // cobrado 12x
} as const;

// ---------------------------------------------------------------------------
// Helper: chama a API do Asaas
// ---------------------------------------------------------------------------
async function asaas(
  method: string,
  path: string,
  body?: object
): Promise<any> {
  const res = await fetch(`${ASAAS_URL}${path}`, {
    method,
    headers: {
      "access_token": Deno.env.get("ASAAS_API_KEY")!,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Asaas ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ---------------------------------------------------------------------------
// Cria ou recupera cliente no Asaas
// ---------------------------------------------------------------------------
async function garantirCliente(prestador: any): Promise<string> {
  // Se já tem ID, retorna direto
  if (prestador.asaas_customer_id) return prestador.asaas_customer_id;

  // Busca por CPF/CNPJ primeiro para não duplicar
  if (prestador.cpf_cnpj) {
    const busca = await asaas("GET", `/customers?cpfCnpj=${prestador.cpf_cnpj}`);
    if (busca.data?.length > 0) return busca.data[0].id;
  }

  // Cria cliente novo
  const cliente = await asaas("POST", "/customers", {
    name:     prestador.nome,
    email:    prestador.email,
    mobilePhone: prestador.whatsapp?.replace(/\D/g, ""),
    cpfCnpj: prestador.cpf_cnpj ?? undefined,
    notificationDisabled: false, // Asaas envia e-mail de cobrança automaticamente
  });

  return cliente.id;
}

// ---------------------------------------------------------------------------
// Handler HTTP
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { billing_type = "PIX", plano = "pro" } = await req.json();

    // Valida plano
    if (!PLANOS[plano as keyof typeof PLANOS]) {
      return Response.json({ erro: "Plano inválido" }, { status: 400 });
    }

    // Autentica o prestador pelo JWT do Supabase
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) return Response.json({ erro: "Não autenticado" }, { status: 401 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Decodifica o JWT para pegar o user_id
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) {
      return Response.json({ erro: "Token inválido" }, { status: 401 });
    }

    // Busca dados do prestador
    const { data: prestador, error: pErr } = await supabase
      .from("prestadores")
      .select("id, nome, email, whatsapp, cpf_cnpj, asaas_customer_id, asaas_sub_id, plano")
      .eq("id", user.id)
      .single();

    if (pErr || !prestador) {
      return Response.json({ erro: "Prestador não encontrado" }, { status: 404 });
    }

    // Já tem assinatura ativa?
    if (prestador.plano === "pro" && prestador.asaas_sub_id) {
      return Response.json({
        aviso: "Você já tem uma assinatura Pro ativa.",
        asaas_sub_id: prestador.asaas_sub_id,
      });
    }

    // Garante cliente no Asaas
    const customerId = await garantirCliente(prestador);

    // Salva o customer_id se era novo
    if (!prestador.asaas_customer_id) {
      await supabase
        .from("prestadores")
        .update({ asaas_customer_id: customerId })
        .eq("id", prestador.id);
    }

    // Próximo vencimento = hoje + 1 dia (trial de 7 dias pode ser configurado aqui)
    const proximoVencimento = new Date();
    proximoVencimento.setDate(proximoVencimento.getDate() + 1);
    const nextDueDate = proximoVencimento.toISOString().slice(0, 10);

    const planoConfig = PLANOS[plano as keyof typeof PLANOS];

    // Cria assinatura no Asaas
    const assinatura = await asaas("POST", "/subscriptions", {
      customer:    customerId,
      billingType: billing_type,           // 'CREDIT_CARD' | 'PIX' | 'BOLETO'
      value:       planoConfig.valor,
      nextDueDate,
      cycle:       "MONTHLY",
      description: planoConfig.descricao,
      // Para cartão: enviar tokenInfo separadamente após redirecionar
      // Para Pix/Boleto: Asaas gera link automático
      fine:        { value: 2 },           // 2% de multa por atraso
      interest:    { value: 1 },           // 1% ao mês de juros
      maxPayments: plano === "anual" ? 12 : null,
    });

    // Guarda o ID da assinatura (plano ainda 'free' — webhook atualiza)
    await supabase
      .from("prestadores")
      .update({ asaas_sub_id: assinatura.id })
      .eq("id", prestador.id);

    // Para Pix e Boleto, Asaas já devolve link de pagamento do 1º ciclo
    let paymentUrl: string | null = null;
    if (billing_type !== "CREDIT_CARD") {
      // Busca o primeiro pagamento da assinatura para pegar o link
      const pagamentos = await asaas("GET", `/payments?subscription=${assinatura.id}`);
      if (pagamentos.data?.length > 0) {
        paymentUrl = pagamentos.data[0].invoiceUrl ?? pagamentos.data[0].bankSlipUrl;
      }
    }

    return Response.json(
      {
        ok: true,
        asaas_sub_id: assinatura.id,
        billing_type,
        payment_url: paymentUrl,
        // Para cartão: o front-end deve abrir o Asaas payment link ou usar o SDK deles
        // para capturar o token do cartão e enviar via PATCH /subscriptions/{id}/creditCard
        asaas_customer_id: customerId,
        message: billing_type === "CREDIT_CARD"
          ? "Assinatura criada. Redirecione o usuário para inserir o cartão."
          : `Assinatura criada. Pague via ${billing_type} para ativar o plano Pro.`,
      },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    console.error("Erro criar-assinatura:", err);
    return Response.json(
      { erro: "Erro interno", detalhe: String(err) },
      { status: 500 }
    );
  }
});
