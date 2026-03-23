// relatorio-pdf.js
// Gera PDF do relatório de receita usando jsPDF (carregado via CDN).
// Importar nas páginas que precisam de exportação:
//   import { exportarRelatorioPDF } from './relatorio-pdf.js'

/**
 * Exporta relatório mensal de receita em PDF.
 * @param {object} dados - { prestador, kpis, receitaMes, porServico, porDia }
 */
export async function exportarRelatorioPDF(dados) {
  // Carrega jsPDF via CDN se ainda não estiver disponível
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W    = doc.internal.pageSize.getWidth();
  const CINZA = [60, 60, 58];
  const VERDE = [138, 184, 48];
  const ESCURO= [14, 13, 10];
  const MES   = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // ── HEADER ──────────────────────────────────────────────────────────────
  doc.setFillColor(...ESCURO);
  doc.rect(0, 0, W, 36, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(200, 240, 96);
  doc.text('AgendaPro', 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(180, 178, 169);
  doc.text('Relatório de Receita', 14, 21);
  doc.text(dados.prestador?.nome ?? '', 14, 27);

  doc.setFontSize(9);
  doc.setTextColor(138, 135, 120);
  doc.text(MES, W - 14, 18, { align: 'right' });
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W - 14, 24, { align: 'right' });

  let y = 46;

  // ── KPIs ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...CINZA);
  doc.text('RESUMO DO MÊS', 14, y);
  y += 6;

  const kpis = [
    { label: 'Receita total',    val: `R$${(dados.kpis.receita_mes ?? 0).toLocaleString('pt-BR')}`,  cor: VERDE },
    { label: 'Atendimentos',     val: String(dados.kpis.atend_mes ?? 0),                              cor: CINZA },
    { label: 'Ticket médio',     val: `R$${Math.round(dados.kpis.ticket_medio ?? 0)}`,                cor: CINZA },
    { label: 'Vs mês anterior',  val: _delta(dados.kpis.receita_mes, dados.kpis.receita_anterior),    cor: CINZA },
  ];

  const cardW = (W - 28 - 9) / 4;
  kpis.forEach((k, i) => {
    const x = 14 + i * (cardW + 3);
    doc.setDrawColor(200, 196, 184);
    doc.setFillColor(250, 248, 243);
    doc.roundedRect(x, y, cardW, 20, 2, 2, 'FD');

    doc.setFillColor(...k.cor);
    doc.rect(x, y, cardW, 1.5, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA);
    doc.text(k.label, x + cardW / 2, y + 8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...k.cor);
    doc.text(k.val, x + cardW / 2, y + 16, { align: 'center' });
  });

  y += 28;

  // ── RECEITA POR SERVIÇO ─────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...CINZA);
  doc.text('RECEITA POR SERVIÇO', 14, y);
  y += 5;

  const totalServicos = (dados.porServico ?? []).reduce((s, d) => s + (d.receita ?? 0), 0);

  if (dados.porServico?.length > 0) {
    dados.porServico.forEach((s, i) => {
      const pct  = totalServicos > 0 ? s.receita / totalServicos : 0;
      const barW = (W - 28 - 36) * pct;

      // fundo da linha
      if (i % 2 === 0) {
        doc.setFillColor(244, 241, 235);
        doc.rect(14, y - 1, W - 28, 8, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...CINZA);
      doc.text(s.nome, 14, y + 4);

      // barra de progresso
      doc.setFillColor(230, 228, 220);
      doc.roundedRect(80, y + 1, W - 28 - 66 - 36, 3.5, 1, 1, 'F');

      doc.setFillColor(...VERDE);
      if (barW > 0) doc.roundedRect(80, y + 1, barW, 3.5, 1, 1, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...VERDE);
      doc.text(`R$${(s.receita ?? 0).toLocaleString('pt-BR')}`, W - 14, y + 4, { align: 'right' });

      y += 8;
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 148, 140);
    doc.text('Sem dados no período', 14, y + 4);
    y += 8;
  }

  y += 8;

  // ── RECEITA POR MÊS ─────────────────────────────────────────────────────
  if (dados.receitaMes?.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...CINZA);
    doc.text('HISTÓRICO MENSAL', 14, y);
    y += 5;

    const maxR   = Math.max(...dados.receitaMes.map(r => r.receita ?? 0), 1);
    const barH   = 30;
    const chartX = 14;
    const chartW = W - 28;
    const barW2  = chartW / dados.receitaMes.length - 4;

    // Eixo y
    doc.setDrawColor(220, 216, 202);
    doc.setLineWidth(0.2);
    doc.line(chartX, y, chartX, y + barH + 6);
    doc.line(chartX, y + barH, chartX + chartW, y + barH);

    dados.receitaMes.forEach((r, i) => {
      const h    = ((r.receita ?? 0) / maxR) * barH;
      const bx   = chartX + i * (barW2 + 4) + 2;
      const by   = y + barH - h;

      doc.setFillColor(200, 240, 96, 0.8);
      doc.setFillColor(138, 184, 48);
      doc.roundedRect(bx, by, barW2, h, 1, 1, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...CINZA);
      doc.text(r.mes, bx + barW2 / 2, y + barH + 4, { align: 'center' });

      // valor no topo da barra
      if (h > 5) {
        doc.setFontSize(5.5);
        doc.setTextColor(...VERDE);
        doc.text(`R$${Math.round(r.receita ?? 0)}`, bx + barW2 / 2, by - 1, { align: 'center' });
      }
    });

    y += barH + 14;
  }

  // ── RODAPÉ ──────────────────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 148, 140);
    doc.text('AgendaPro · Relatório gerado automaticamente', 14, 293);
    doc.text(`Página ${p} de ${totalPages}`, W - 14, 293, { align: 'right' });
  }

  // ── SALVA ────────────────────────────────────────────────────────────────
  const nomeArq = `relatorio-${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.pdf`;
  doc.save(nomeArq);
  return nomeArq;
}

function _delta(atual, anterior) {
  if (!anterior || anterior === 0) return '+0%';
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  return (pct >= 0 ? '+' : '') + pct + '%';
}
