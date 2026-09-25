"""Leitura de contas de energia do Grupo A em PDF.

Estratégia: extrair o texto do PDF e procurar, linha a linha, os rótulos
comuns nas contas ("Demanda Contratada", "Demanda Medida", "Ponta",
"Fora Ponta", "Referência"...). O que não for encontrado fica em branco
para o usuário completar na etapa de conferência.

ATENÇÃO: os padrões abaixo são genéricos e ainda precisam ser calibrados
com contas reais de cada distribuidora (Light, Energisa, Enel).
"""

import re

import pdfplumber

DISTRIBUIDORAS = {
    "Light": r"\bLIGHT\b",
    "Energisa": r"\bENERGISA\b",
    "Enel": r"\bENEL\b",
}

MESES = {"JAN": 1, "FEV": 2, "MAR": 3, "ABR": 4, "MAI": 5, "JUN": 6,
         "JUL": 7, "AGO": 8, "SET": 9, "OUT": 10, "NOV": 11, "DEZ": 12}

# Número no formato brasileiro: 1.234,56 ou 410,40 ou 500
NUMERO = r"\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?"

NOMES_CAMPOS = {
    "mes": "mês de referência",
    "contratada": "demanda contratada",
    "medida": "demanda medida",
    "contratada_p": "demanda contratada na ponta",
    "medida_p": "demanda medida na ponta",
}


def numero_br(texto):
    """Converte '1.234,56' em 1234.56."""
    return float(texto.replace(".", "").replace(",", "."))


def identificar_distribuidora(texto):
    for nome, padrao in DISTRIBUIDORAS.items():
        if re.search(padrao, texto):
            return nome
    return None


def identificar_modalidade(texto):
    """'Azul', 'Verde' ou None."""
    perto_do_rotulo = re.search(r"(?:MODALIDADE|TARIF|SUBGRUPO|HOR[ÁA]RIA)[^\n]{0,60}?\b(AZUL|VERDE)\b", texto)
    if perto_do_rotulo:
        return perto_do_rotulo.group(1).capitalize()
    tem_azul = re.search(r"\bAZUL\b", texto)
    tem_verde = re.search(r"\bVERDE\b", texto)
    if tem_azul and not tem_verde:
        return "Azul"
    if tem_verde and not tem_azul:
        return "Verde"
    return None


def identificar_mes(texto):
    """Mês de referência no formato 'MM/AAAA', ou None."""
    # O trecho entre o rótulo e a data não pode ter dígitos, para não pegar o vencimento
    rotulo = r"(?:REFER[ÊE]NCIA|M[ÊE]S\s*/\s*ANO|M[ÊE]S\s+REF)[^\n\d]{0,30}?"
    padroes = [
        rotulo + r"\b(\d{2})\s*/\s*(\d{4})\b",
        rotulo + r"\b([A-ZÇ]{3,9})\s*(?:/|DE)\s*(\d{4})\b",
        r"\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-ZÇ]*\s*(?:/|DE)\s*(\d{4})\b",
        r"\b(\d{2})/(\d{4})\b",
    ]
    for padrao in padroes:
        for mes, ano in re.findall(padrao, texto):
            numero = int(mes) if mes.isdigit() else MESES.get(mes[:3])
            if numero and 1 <= numero <= 12:
                return f"{numero:02d}/{ano}"
    return None


def _posto(trecho):
    """'p' para ponta, 'fp' para fora de ponta, None se a linha não diz."""
    if re.search(r"FORA\s*(?:DE\s*)?PONTA|F\.?\s?PONTA|\bH?FP\b", trecho):
        return "fp"
    if re.search(r"\bPONTA\b|\bHP\b", trecho):
        return "p"
    return None


def extrair_demandas(texto):
    """Procura linhas de demanda contratada e medida. Retorna dict com os campos achados."""
    achados = {}
    for linha in texto.splitlines():
        if "DEMANDA" not in linha or "ULTRAP" in linha:
            continue
        trecho = linha[linha.index("DEMANDA"):]
        if "CONTRAT" in trecho:
            tipo = "contratada"
        elif re.search(r"MEDID|REGISTR|LIDA|MEDI[ÇC]", trecho):
            tipo = "medida"
        else:
            continue
        numeros = re.findall(NUMERO, trecho)
        if not numeros:
            continue
        campo = tipo + "_p" if _posto(trecho) == "p" else tipo
        achados.setdefault(campo, numero_br(numeros[0]))  # fica com a 1ª ocorrência
    return achados


def extrair_de_texto(texto):
    """Extrai todos os campos de um texto de conta (útil também para testes)."""
    texto = texto.upper()
    dados = {
        "distribuidora": identificar_distribuidora(texto),
        "modalidade": identificar_modalidade(texto),
        "mes": identificar_mes(texto),
    }
    dados.update(extrair_demandas(texto))
    return dados


def ler_pdf(arquivo, nome):
    """Lê um PDF (caminho ou arquivo enviado) e devolve os dados + avisos amigáveis."""
    resultado = {"arquivo": nome, "avisos": [], "texto": ""}
    try:
        with pdfplumber.open(arquivo) as pdf:
            texto = "\n".join(pagina.extract_text() or "" for pagina in pdf.pages)
    except Exception:
        resultado["avisos"].append(
            "Não consegui abrir este arquivo. Ele pode estar protegido por senha ou corrompido. "
            "Digite os valores desta conta na tabela.")
        return resultado

    resultado["texto"] = texto
    if len(texto.strip()) < 50:
        resultado["avisos"].append(
            "Este PDF parece ser uma imagem escaneada, e não consigo ler o texto dele. "
            "Digite os valores desta conta na tabela.")
        return resultado

    resultado.update(extrair_de_texto(texto))

    obrigatorios = ["mes", "contratada", "medida"]
    if resultado.get("modalidade") == "Azul":
        obrigatorios += ["contratada_p", "medida_p"]
    faltando = [NOMES_CAMPOS[c] for c in obrigatorios if resultado.get(c) is None]
    if faltando:
        resultado["avisos"].append("Não encontrei: " + ", ".join(faltando) + ". Complete na tabela.")
    if resultado.get("distribuidora") is None:
        resultado["avisos"].append("Não reconheci a distribuidora desta conta.")
    return resultado
