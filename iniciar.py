"""Abre o Otimizador de Demanda no navegador (usado pelo atalho do pacote)."""

import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

PASTA = Path(__file__).resolve().parent


def porta_em_uso(porta):
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", porta)) == 0


def porta_livre(inicio=8501):
    for porta in range(inicio, inicio + 50):
        if not porta_em_uso(porta):
            return porta
    raise RuntimeError("Nenhuma porta livre encontrada.")


def main():
    porta = porta_livre()
    print("Abrindo o Otimizador de Demanda... aguarde alguns segundos.")
    servidor = subprocess.Popen(
        [sys.executable, "-m", "streamlit", "run", str(PASTA / "app.py"),
         "--server.port", str(porta)],
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
