"""Otimizador de Demanda Contratada — interface web em 3 etapas.

Para rodar:  python -m streamlit run app.py
"""

import re
from collections import Counter
from datetime import date
from pathlib import Path

import pandas as pd
import streamlit as st

import calculo
import graficos
import leitor_pdf
import relatorio

# Colunas da tabela de conferência. Na tarifa verde só as duas primeiras de demanda
# são usadas; na azul elas representam o "fora de ponta".
MES, ARQUIVO = "Mês", "Arquivo"
CONTRATADA, MEDIDA = "Contratada (kW)", "Medida (kW)"
CONTRATADA_P, MEDIDA_P = "Contratada ponta (kW)", "Medida ponta (kW)"
COLUNAS = [MES, ARQUIVO, CONTRATADA, MEDIDA, CONTRATADA_P, MEDIDA_P]

VERSAO = (Path(__file__).parent / "VERSAO").read_text(encoding="utf-8").strip()

PARAMETROS_PADRAO = {"modalidade": "Verde", "tarifa": 35.0, "tarifa_p": 90.0, "crescimento": 0.0}

# Dados de exemplo (valores ilustrativos) para conhecer o programa
EXEMPLO_MEDIDA = [410, 435, 460, 420, 380, 350, 340, 355, 390, 425, 450, 470]
EXEMPLO_PONTA = [280, 300, 310, 290, 260, 240, 230, 245, 270, 295, 305, 320]


# ---------------------------------------------------------------- utilidades

def reais(valor):
    """Formata número no padrão brasileiro: R$ 1.234,56"""
    return "R$ " + f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def ultimos_meses(quantidade=12):
    """Lista 'MM/AAAA' dos últimos meses completos, do mais antigo ao mais recente."""
    hoje = date.today()
    ano, mes = hoje.year, hoje.month
    meses = []
    for _ in range(quantidade):
        mes -= 1
        if mes == 0:
            ano, mes = ano - 1, 12
        meses.append(f"{mes:02d}/{ano}")
    return meses[::-1]


def ordem_do_mes(texto):
    """Chave para ordenar 'MM/AAAA' cronologicamente."""
    m = re.fullmatch(r"(\d{2})/(\d{4})", str(texto).strip())
    return (int(m.group(2)), int(m.group(1))) if m else (9999, 99)


def ir_para(etapa):
    st.session_state.etapa = etapa
    st.rerun()


def recomecar():
    st.session_state.etapa = 1
    st.session_state.leituras = []
    st.session_state.tabela = None
    st.session_state.parametros = dict(PARAMETROS_PADRAO)


def tabela_das_leituras(leituras):
    linhas = [{MES: l.get("mes"), ARQUIVO: l["arquivo"],
               CONTRATADA: l.get("contratada"), MEDIDA: l.get("medida"),
               CONTRATADA_P: l.get("contratada_p"), MEDIDA_P: l.get("medida_p")}
              for l in leituras]
    tabela = pd.DataFrame(linhas, columns=COLUNAS)
    return tabela.sort_values(MES, key=lambda s: s.map(ordem_do_mes)).reset_index(drop=True)


def tabela_vazia():
    return pd.DataFrame({MES: ultimos_meses(), ARQUIVO: "digitado", CONTRATADA: None,
                         MEDIDA: None, CONTRATADA_P: None, MEDIDA_P: None}, columns=COLUNAS)


def tabela_exemplo():
    return pd.DataFrame({MES: ultimos_meses(), ARQUIVO: "exemplo", CONTRATADA: 500.0,
                         MEDIDA: EXEMPLO_MEDIDA, CONTRATADA_P: 250.0, MEDIDA_P: EXEMPLO_PONTA},
                        columns=COLUNAS)


def indicador_de_etapas(atual):
    nomes = ["Enviar contas", "Conferir valores", "Ver resultado"]
    for numero, (coluna, nome) in enumerate(zip(st.columns(3), nomes), start=1):
        if numero < atual:
            coluna.markdown(f":green[✔ {numero}. {nome}]")
        elif numero == atual:
            coluna.markdown(f":blue[**➜ {numero}. {nome}**]")
        else:
            coluna.markdown(f":gray[{numero}. {nome}]")
    st.divider()


# ---------------------------------------------------------------- etapa 1

def etapa_enviar():
    st.subheader("Envie as contas de energia")
    st.write("Arraste para o quadro abaixo os PDFs das contas de energia (Light, Energisa ou Enel). "
             "Envie uma conta por mês — o ideal são os **últimos 12 meses**, para que a análise "
             "considere as variações ao longo do ano (verão, férias, etc.).")

    arquivos = st.file_uploader("Contas em PDF", type="pdf", accept_multiple_files=True,
                                label_visibility="collapsed")

    if st.button("Ler as contas e continuar ➜", type="primary", disabled=not arquivos,
                 width="stretch"):
        with st.spinner("Lendo as contas..."):
            leituras = [leitor_pdf.ler_pdf(a, a.name) for a in arquivos]
        st.session_state.leituras = leituras
        st.session_state.tabela = tabela_das_leituras(leituras)
        detectadas = [l["modalidade"] for l in leituras if l.get("modalidade")]
        if detectadas:
            st.session_state.parametros["modalidade"] = Counter(detectadas).most_common(1)[0][0]
        ir_para(2)

    st.write("")
    st.caption("Não tem os PDFs à mão?")
    col1, col2 = st.columns(2)
    if col1.button("✏️ Prefiro digitar os valores", width="stretch"):
        st.session_state.leituras = []
        st.session_state.tabela = tabela_vazia()
        ir_para(2)
    if col2.button("🔍 Ver um exemplo", width="stretch"):
        st.session_state.leituras = []
        st.session_state.tabela = tabela_exemplo()
        ir_para(2)


# ---------------------------------------------------------------- etapa 2

def mostrar_leituras(leituras):
    com_aviso = sum(1 for l in leituras if l["avisos"])
    titulo = f"Leitura dos arquivos: {len(leituras) - com_aviso} ok"
    if com_aviso:
        titulo += f", {com_aviso} precisam de atenção"
    with st.expander(titulo, expanded=bool(com_aviso)):
        for l in leituras:
            partes = [l.get("distribuidora"), l.get("mes"),
                      f"tarifa {l['modalidade']}" if l.get("modalidade") else None]
            descricao = " · ".join(p for p in partes if p)
            if l["avisos"]:
                st.warning(f"**{l['arquivo']}** {descricao}\n\n" + "\n\n".join(l["avisos"]), icon="⚠️")
            else:
                st.success(f"**{l['arquivo']}** — {descricao}", icon="✅")
    lidos = [l for l in leituras if l["texto"]]
    if lidos:
        with st.expander("Ver o texto extraído dos PDFs (para suporte)"):
            escolhido = st.selectbox("Arquivo", [l["arquivo"] for l in lidos])
            st.text(next(l["texto"] for l in lidos if l["arquivo"] == escolhido))


def validar(tabela, azul):
    """Limpa a tabela e devolve (tabela, lista de erros)."""
    tabela = tabela.copy()
    tabela[MES] = tabela[MES].fillna("").astype(str).str.strip()
    tabela = tabela[tabela[MES] != ""]
    for coluna in (CONTRATADA, MEDIDA, CONTRATADA_P, MEDIDA_P):
        tabela[coluna] = pd.to_numeric(tabela[coluna], errors="coerce")

    medidas = [MEDIDA, MEDIDA_P] if azul else [MEDIDA]
    contratadas = [CONTRATADA, CONTRATADA_P] if azul else [CONTRATADA]
    erros = []
    if tabela.empty:
        return tabela, ["Preencha pelo menos um mês na tabela."]

    formato_errado = tabela[~tabela[MES].str.fullmatch(r"\d{2}/\d{4}")][MES].tolist()
    if formato_errado:
        erros.append(f"Escreva o mês no formato MM/AAAA (ex.: 09/2026). Verifique: {', '.join(formato_errado)}.")
    repetidos = tabela[tabela[MES].duplicated()][MES].unique().tolist()
    if repetidos:
        erros.append(f"Cada mês deve aparecer uma vez só. Repetido(s): {', '.join(repetidos)}.")
    sem_medida = tabela[tabela[medidas].isna().any(axis=1)][MES].tolist()
    if sem_medida:
        erros.append(f"Falta a demanda medida em: {', '.join(sem_medida)}.")
    for coluna in contratadas:
        if tabela[coluna].isna().all():
            erros.append(f"Preencha a coluna \"{rotulo(coluna, azul)}\" em pelo menos um mês "
                         "(de preferência no mais recente).")

    tabela = tabela.sort_values(MES, key=lambda s: s.map(ordem_do_mes)).reset_index(drop=True)
    return tabela, erros


def rotulo(coluna, azul):
    if azul and coluna == CONTRATADA:
        return "Contratada fora ponta (kW)"
    if azul and coluna == MEDIDA:
        return "Medida fora ponta (kW)"
    return coluna


def etapa_conferir():
    p = st.session_state.parametros
    st.subheader("Confira os valores")

    if st.session_state.leituras:
        mostrar_leituras(st.session_state.leituras)

    modalidade = st.radio(
        "Modalidade tarifária", ["Verde", "Azul"], horizontal=True,
        index=["Verde", "Azul"].index(p["modalidade"]),
        help="Está escrita na conta, perto de \"Modalidade tarifária\" ou \"Subgrupo\".")
    azul = modalidade == "Azul"
    st.caption("**Verde:** um único valor de demanda contratada. "
               "**Azul:** um valor para o horário de ponta e outro para fora de ponta.")

    st.markdown("**Demandas de cada mês** — corrija o que estiver errado e preencha as células vazias. "
                "Você também pode colar valores copiados do Excel.")
    ajuda_contratada = "Valor de demanda que consta no contrato com a distribuidora naquele mês."
    ajuda_medida = "Maior demanda registrada pelo medidor no mês (também chamada de demanda registrada ou lida)."
    config = {
        MES: st.column_config.TextColumn(MES, help="Mês de referência da conta, no formato MM/AAAA."),
        ARQUIVO: st.column_config.TextColumn(ARQUIVO, disabled=True),
        CONTRATADA: st.column_config.NumberColumn(rotulo(CONTRATADA, azul), min_value=0, format="%.1f",
                                                  help=ajuda_contratada),
        MEDIDA: st.column_config.NumberColumn(rotulo(MEDIDA, azul), min_value=0, format="%.1f",
                                              help=ajuda_medida),
        CONTRATADA_P: st.column_config.NumberColumn(CONTRATADA_P, min_value=0, format="%.1f",
                                                    help=ajuda_contratada),
        MEDIDA_P: st.column_config.NumberColumn(MEDIDA_P, min_value=0, format="%.1f", help=ajuda_medida),
    }
    visiveis = [MES, ARQUIVO, CONTRATADA_P, MEDIDA_P, CONTRATADA, MEDIDA] if azul else [MES, ARQUIVO, CONTRATADA, MEDIDA]
    editada = st.data_editor(st.session_state.tabela, column_config=config, column_order=visiveis,
                             num_rows="dynamic", hide_index=True, width="stretch")
    st.caption("A demanda contratada **atual** é a do mês mais recente da tabela.")

    st.markdown("**Tarifas de demanda**")
    st.caption("Na conta, procure a linha de *Demanda* e use o preço por kW (R$/kW), de preferência já com impostos. "
               "A tarifa **não muda** qual é a demanda recomendada — ela só serve para calcular a economia em reais.")
    if azul:
        col1, col2 = st.columns(2)
        tarifa_p = col1.number_input("Tarifa na ponta (R$/kW)", min_value=0.0, value=p["tarifa_p"], step=0.5)
        tarifa = col2.number_input("Tarifa fora de ponta (R$/kW)", min_value=0.0, value=p["tarifa"], step=0.5)
    else:
        tarifa = st.number_input("Tarifa de demanda (R$/kW)", min_value=0.0, value=p["tarifa"], step=0.5)
        tarifa_p = p["tarifa_p"]

    crescimento = st.number_input(
        "Crescimento de carga previsto (%)", min_value=-50.0, max_value=200.0,
        value=p["crescimento"], step=1.0,
        help="Use se houver previsão de novos equipamentos, expansão ou redução de atividades. "
             "Ex.: 10 = a demanda vai crescer 10% em relação aos meses da tabela.")

    st.write("")
    col1, col2 = st.columns(2)
    if col1.button("⬅ Voltar", width="stretch"):
        ir_para(1)
    if col2.button("Calcular ➜", type="primary", width="stretch"):
        tabela, erros = validar(editada, azul)
        if not erros and (tarifa <= 0 or (azul and tarifa_p <= 0)):
            erros.append("Informe a tarifa de demanda (valor maior que zero).")
        if erros:
            for erro in erros:
                st.error(erro, icon="✋")
            return
        st.session_state.tabela = tabela
        st.session_state.parametros = {"modalidade": modalidade, "tarifa": tarifa,
                                       "tarifa_p": tarifa_p, "crescimento": crescimento}
        ir_para(3)


# ---------------------------------------------------------------- etapa 3

def frase_recomendacao(nome, r):
    atual, otima = f"{r['atual']:.0f} kW", f"{r['otima']} kW"
    if r["otima"] < r["atual"]:
        return (f"**{nome}:** reduzir de {atual} para **{otima}**. "
                "Hoje é paga uma demanda maior do que a realmente usada.")
    if r["otima"] > r["atual"]:
        n = r["meses_ultrapassagem_atual"]
        return (f"**{nome}:** aumentar de {atual} para **{otima}**. "
                f"Com o contrato atual houve multa de ultrapassagem em {n} {'mês' if n == 1 else 'meses'}, "
                f"somando {reais(r['multa_atual'])}. Contratar um pouco mais sai mais barato que pagar a multa.")
    return f"**{nome}:** manter {atual}. O valor atual já é o mais econômico."


def mostrar_posto(meses, r):
    c1, c2, c3 = st.columns(3)
    c1.metric("Contratada atual", f"{r['atual']:.0f} kW", help="Valor do mês mais recente da tabela.")
    c2.metric("Recomendada", f"{r['otima']} kW",
              help="Valor que resulta no menor custo total no período, considerando as multas de ultrapassagem.")
    c3.metric("Economia no período", reais(r["economia"]),
              f"{r['economia'] / r['custo_atual']:.1%}".replace(".", ",") if r["custo_atual"] else None,
              help=f"Custo atual {reais(r['custo_atual'])} − custo com a recomendada {reais(r['custo_otimo'])}.")

    st.markdown("##### Demanda medida mês a mês")
    st.plotly_chart(graficos.demanda_por_mes(meses, r), width="stretch")
    st.caption("Cada barra é a maior demanda registrada no mês. **Barras vermelhas** são meses com multa de "
               "ultrapassagem no contrato atual. A **linha verde** é a demanda recomendada, e a pontilhada "
               "mostra até onde a demanda pode chegar sem multa (5% acima da contratada).")

    st.markdown("##### Quanto custaria cada opção")
    st.plotly_chart(graficos.curva_de_custo(r), width="stretch")
    st.caption("Cada ponto da curva mostra quanto seria pago de demanda no período para cada valor contratado. "
               "**À esquerda** do ponto verde, as multas de ultrapassagem encarecem a conta; **à direita**, "
               "paga-se por uma demanda que não é usada.")

    with st.expander("Ver detalhes mês a mês"):
        detalhe = pd.DataFrame({
            "Mês": meses,
            "Medida (kW)": r["medidas"],
            f"Custo atual ({r['atual']:.0f} kW)": [l["custo"] for l in r["detalhe_atual"]],
            "Multa atual": [l["multa"] for l in r["detalhe_atual"]],
            f"Custo recomendado ({r['otima']} kW)": [l["custo"] for l in r["detalhe_otimo"]],
            "Multa recomendada": [l["multa"] for l in r["detalhe_otimo"]],
        })
        colunas_reais = detalhe.columns[2:]
        estilo = detalhe.style.format({c: reais for c in colunas_reais}).format({"Medida (kW)": "{:.1f}"})
        st.dataframe(estilo, hide_index=True, width="stretch")


def etapa_resultado():
    tabela = st.session_state.tabela
    p = st.session_state.parametros
    azul = p["modalidade"] == "Azul"
    meses = tabela[MES].tolist()
    fator = 1 + p["crescimento"] / 100

    def analisar(col_medida, col_contratada, tarifa):
        medidas = [m * fator for m in tabela[col_medida]]
        atual = tabela[col_contratada].dropna().iloc[-1]
        return calculo.analisar_posto(medidas, tarifa, atual)

    if azul:
        resultados = {"Ponta": analisar(MEDIDA_P, CONTRATADA_P, p["tarifa_p"]),
                      "Fora de ponta": analisar(MEDIDA, CONTRATADA, p["tarifa"])}
    else:
        resultados = {"Demanda": analisar(MEDIDA, CONTRATADA, p["tarifa"])}

    economia = sum(r["economia"] for r in resultados.values())
    if economia > 0.5:
        st.success(f"### Economia estimada de {reais(economia)}\n"
                   f"nos {len(meses)} meses analisados ({meses[0]} a {meses[-1]}), ajustando a demanda contratada:",
                   icon="💡")
    else:
        st.info("### A demanda contratada já está no valor mais econômico\n"
                "Não há ajuste que reduza o custo no período analisado.", icon="👍")
    for nome, r in resultados.items():
        st.markdown("- " + frase_recomendacao(nome, r))

    if len(meses) < 12:
        st.warning(f"A análise usou só {len(meses)} meses. Com menos de 12, a recomendação pode não considerar "
                   "os meses de maior consumo do ano. Se possível, inclua mais contas.", icon="📅")
    if p["crescimento"]:
        st.info(f"As demandas medidas foram ajustadas em {p['crescimento']:+.1f}% para considerar o crescimento "
                "de carga previsto.", icon="📈")

    st.divider()
    if azul:
        for aba, (nome, r) in zip(st.tabs(list(resultados)), resultados.items()):
            with aba:
                mostrar_posto(meses, r)
    else:
        mostrar_posto(meses, resultados["Demanda"])

    st.divider()
    st.download_button("📥 Baixar relatório em Excel", type="primary", width="stretch",
                       data=relatorio.gerar_excel(resultados, meses, p),
                       file_name=f"analise_demanda_{date.today():%Y-%m-%d}.xlsx",
                       mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    with st.expander("ℹ️ Antes de pedir a alteração à distribuidora"):
        st.markdown(
            "- A análise considera apenas a **parcela de demanda** da conta, não o consumo em kWh.\n"
            "- Confirme com a distribuidora os **prazos e condições** para alterar o contrato: "
            "reduções costumam ter regras de antecedência e carência.\n"
            "- Se houver previsão de **novos equipamentos ou expansão**, volte à etapa anterior e informe "
            "o crescimento de carga previsto.\n"
            f"- O menor valor considerado é {calculo.DEMANDA_MINIMA} kW, mínimo do Grupo A.")

    col1, col2 = st.columns(2)
    if col1.button("⬅ Voltar e corrigir valores", width="stretch"):
        ir_para(2)
    if col2.button("🔄 Nova análise", width="stretch"):
        recomecar()
        st.rerun()


# ---------------------------------------------------------------- tela

st.set_page_config(page_title="Otimizador de Demanda", page_icon="⚡", layout="centered")

if "etapa" not in st.session_state:
    recomecar()

st.title("⚡ Otimizador de Demanda Contratada")
st.caption("Descubra o valor de demanda contratada que deixa a conta de energia mais barata.")
indicador_de_etapas(st.session_state.etapa)

{1: etapa_enviar, 2: etapa_conferir, 3: etapa_resultado}[st.session_state.etapa]()

st.divider()
st.caption(f"Versão {VERSAO}")
