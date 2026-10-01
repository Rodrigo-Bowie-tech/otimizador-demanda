"""Abre o Otimizador de Demanda no navegador (usado pelo atalho do pacote).

Antes de abrir, procura uma versão nova no GitHub e, se houver, se atualiza
sozinho. Sem internet, segue normalmente com a versão instalada.
"""

import io
import json
import socket
import subprocess
import sys
import time
import webbrowser
import zipfile
from pathlib import Path
from urllib.request import Request, urlopen

PASTA = Path(__file__).resolve().parent
REPOSITORIO = "Rodrigo-Bowie-tech/otimizador-demanda"
PAGINA_DOWNLOAD = f"https://github.com/{REPOSITORIO}/releases/latest"


def porta_em_uso(porta):
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", porta)) == 0


def porta_livre(inicio=8501):
    for porta in range(inicio, inicio + 50):
        if not porta_em_uso(porta):
            return porta
    raise RuntimeError("Nenhuma porta livre encontrada.")


def ler(nome):
    caminho = PASTA / nome
    return caminho.read_text(encoding="utf-8").strip() if caminho.exists() else ""


def numero_da_versao(texto):
    """'1.10.2' -> (1, 10, 2), para comparar versões corretamente."""
    return tuple(int(parte) for parte in texto.strip().lstrip("v").split("."))


def baixar(url):
    with urlopen(Request(url, headers={"User-Agent": "OtimizadorDemanda"}), timeout=10) as resposta:
        return resposta.read()


def atualizar():
    """Instala a versão mais recente publicada no GitHub, se for mais nova que a atual."""
    try:
        release = json.loads(baixar(f"https://api.github.com/repos/{REPOSITORIO}/releases/latest"))
        nova = release["tag_name"].lstrip("v")
        if numero_da_versao(nova) <= numero_da_versao(ler("VERSAO") or "0"):
            return
        arquivos = {a["name"]: a["browser_download_url"] for a in release["assets"]}
        print(f"Atualizando para a versão {nova}...")
        pacote = zipfile.ZipFile(io.BytesIO(baixar(arquivos["atualizacao.zip"])))
    except Exception:
        return  # sem internet ou GitHub fora do ar: usa a versão instalada

    # Bibliotecas novas não vêm na atualização: aí é preciso baixar o pacote completo
    if pacote.read("requirements.txt").decode("utf-8").split() != ler("requirements.txt").split():
        print(f"\nA versão {nova} precisa do pacote completo. Baixe em:\n{PAGINA_DOWNLOAD}\n"
              "Por enquanto, o programa vai abrir na versão atual.\n")
        return
    for item in pacote.infolist():
        destino = (PASTA / item.filename).resolve()
        if item.is_dir() or not destino.is_relative_to(PASTA):
            continue
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(pacote.read(item))
    print(f"Pronto! Atualizado para a versão {nova}.\n")


def main():
    atualizar()
    porta = porta_livre()
    print("Abrindo o Otimizador de Demanda... aguarde alguns segundos.")
    servidor = subprocess.Popen(
        [sys.executable, "-m", "streamlit", "run", str(PASTA / "app.py"),
         "--server.port", str(porta), "--server.address", "localhost"],
        cwd=PASTA, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)

    for _ in range(120):  # espera até 60 s o programa ficar pronto
        if servidor.poll() is not None:
            print("\nO programa não conseguiu iniciar. Detalhes do erro:\n")
            print(servidor.stderr.read())
            input("Pressione Enter para fechar.")
            return
        if porta_em_uso(porta):
            break
        time.sleep(0.5)

    endereco = f"http://localhost:{porta}"
    webbrowser.open(endereco)
    print(f"\nPronto! O programa abriu no navegador ({endereco}).")
    print("Se fechar a aba sem querer, é só acessar esse endereço de novo.")
    print("\n>>> Para ENCERRAR o programa, feche esta janela. <<<")
    try:
        servidor.wait()
    except KeyboardInterrupt:
        servidor.terminate()


if __name__ == "__main__":
    main()
