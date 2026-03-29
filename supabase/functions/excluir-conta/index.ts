// supabase/functions/excluir-conta/index.ts
//
// Exclui permanentemente a conta de um prestador:
// 1. Remove o usuário do Supabase Auth
// 2. Remove o prestador do banco (CASCADE apaga dados relacionados)
//
// POST {} (sem body — usa o JWT para identificar o usuário)
// Header: Authorization: Bearer <supabase-jwt>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) {
      return Response.json({ erro: "Não autenticado" }, { status: 401, headers: CORS_HEADERS });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Decodifica o JWT para pegar o user_id
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) {
      return Response.json({ erro: "Token inválido" }, { status: 401, headers: CORS_HEADERS });
    }

    const userId = user.id;

    // 1. Remove do Supabase Auth (usando Admin API)
    // Nota: Isso não é suportado diretamente pelo client, precisamos usar a API REST
    const authUrl = `${Deno.env.get("SUPABASE_URL")}/auth/v1/admin/users/${userId}`;
    const authRes = await fetch(authUrl, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
      },
    });

    if (!authRes.ok) {
      const erro = await authRes.text();
      console.error("Erro ao deletar do Auth:", authRes.status, erro);
      // Continua mesmo assim para tentar apagar do banco
    }

    // 2. Remove do banco (CASCADE apaga dados relacionados)
    const { error: errP } = await supabase
      .from("prestadores")
      .delete()
      .eq("id", userId);

    if (errP) {
      console.error("Erro ao deletar prestador:", errP);
      return Response.json(
        { erro: "Erro ao excluir conta", detalhe: errP.message },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return Response.json(
      { ok: true, mensagem: "Conta excluída com sucesso" },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Erro:", err);
    return Response.json(
      { erro: "Erro interno", detalhe: String(err) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
