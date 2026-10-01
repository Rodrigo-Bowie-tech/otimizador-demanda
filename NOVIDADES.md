# Novidades

## 2.4.0

- Lê as faturas da Enel (antiga Ampla), além das da Light, e reconhece as notas da Energisa: é só enviar
  os PDFs de todas as distribuidoras juntos, que o app identifica cada uma.
- Nas faturas da Enel, os meses que faltam vêm do histórico de 13 meses impresso na própria nota, até
  completar 12 meses por unidade.
- Unidades do Grupo B (baixa tensão) e PDFs só com o resumo do faturamento são identificados e explicados.
- Resultado com filtro por distribuidora (Todas, Light, Enel...), e relatórios da distribuidora escolhida.
- Comparação de modalidades com as tarifas de cada distribuidora e os tributos de cada unidade
  (considera, por exemplo, unidades isentas de ICMS); na Enel, usa a demanda medida na ponta das unidades verdes.

## 2.3.0

- O app agora diz se vale a pena trocar de modalidade tarifária (verde x azul): compara o custo de
  demanda + energia de cada modalidade, cada uma com a demanda contratada ideal.
- Consumos de energia (kWh) na ponta e fora de ponta e as tarifas de energia de cada modalidade são
  lidos das faturas da Light; as tarifas podem ser conferidas e completadas na etapa 2.
- Resultado, resumo de todas as unidades, PDF e Excel mostram a modalidade recomendada.

## 2.2.0

- Relatório em PDF com estrutura de relatório técnico: capa, introdução, metodologia e premissas,
  medições, análise de cada unidade consumidora (com gráficos e tabelas) e conclusão com recomendações.
- A planilha Excel traz todas as unidades: uma aba por unidade, com o mês a mês e os gráficos.
- Gráficos melhores: faixa de tolerância sem multa, contrato de cada mês, curva de custo focada na região
  que interessa com a economia indicada, novo gráfico de custo mensal (atual x recomendada, com a multa
  destacada) e gráfico de economia por unidade.

## 2.1.0

- Lê as faturas agrupadas da Light, com várias unidades consumidoras no mesmo PDF.
- Demanda contratada, demanda medida (com a perda de transformação, quando houver) e tarifas
  de demanda são preenchidas a partir da conta.
- Com várias unidades, o resultado mostra um resumo de todas, da que mais economiza para a que
  menos, e o relatório em Excel ganha a aba "Todas as unidades".

## 2.0.0

- Agora é um app que se instala no celular (Android e iPhone) e no computador, direto pelo navegador.
- Atualiza sozinho: sempre que há internet, o app baixa a versão nova.
- Funciona sem internet depois de instalado.
- As contas continuam sendo lidas no próprio aparelho, sem envio para a internet.
- Cores dos gráficos ajustadas para pessoas com daltonismo.
- A versão antiga em Python foi guardada na pasta `versao-python/`, só para consulta.

## 1.1.0

- O programa agora se atualiza sozinho: ao abrir, ele procura uma versão nova e a instala.
- Número da versão aparece no rodapé da tela.
- Bibliotecas com versões fixas, para o pacote sair sempre igual.

## 1.0.0

- Primeira versão: leitura das contas em PDF, cálculo da demanda ótima (tarifas verde e azul),
  gráficos e relatório em Excel.
