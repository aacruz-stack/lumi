# Lumi Bronze das Mina — agendamento e painel

Site de agendamento (parte visual) hospedado no GitHub Pages, com um painel para a dona (Stephanie) e um back-end em Google Apps Script + Google Sheets (parte de dados).

- **Site da cliente:** `index.html` (agendamento)
- **Painel da dona:** `admin.html` (protegido por senha no servidor)
- **Back-end:** projeto "Lumi" no Google Apps Script, ligado a uma planilha do Google (conta do Lumi)

> 📖 **Todas as regras do negócio, bem explicadas:** [REGRAS.md](REGRAS.md)

## Como funciona o agendamento

1. A cliente escolhe serviço (ou pacote), adicionais, datas e informa nome e WhatsApp (e-mail é opcional).
2. Escolhe como pagar:
   - **Pix:** paga o sinal de 50% na hora, avisa "já fiz o Pix" e a dona confirma no painel.
   - **Cartão de débito, cartão de crédito ou dinheiro:** paga tudo no local. Não há sinal. A reserva fica aguardando a aprovação da dona.
3. A dona confirma/aprova no painel. Isso cria os eventos na Agenda Google e avisa a cliente (e-mail, se informado, e botão de WhatsApp).
4. Ao **finalizar o atendimento** ("sessão realizada") o painel pergunta se o restante foi pago (100% do valor, no pagamento no local). O que ainda não foi recebido fica **pendente de confirmar** no Financeiro e só conta como dinheiro recebido depois da confirmação.

## Abas do painel

| Aba | Para que serve |
|---|---|
| Pendentes | Reservas para confirmar/aprovar |
| Caixa | Venda no balcão: sessão por minuto, itens do catálogo, itens avulsos, desconto, pagamento parcial |
| Agenda / Pacotes / Bloqueios | Sessões marcadas, pacotes em aberto, horários bloqueados |
| Estoque | Insumos (custo calculado pelo preço da embalagem), fichas técnicas, movimentos; baixa automática ao realizar a sessão |
| Financeiro | Resumo do mês, lançamentos (automáticos e manuais), pendentes de confirmar, CMV por procedimento |
| Catálogo / Ajustes | Itens, promoções, regras, horários e dados do negócio |
| Assistente | IA (Gemini): analisa só números agregados e sugere ações; nunca altera nada |

**Testes e limpeza (Ajustes):** dê aos testes um nome que comece com `TESTE`. Em Ajustes dá para apagar todos de uma vez ou reserva por reserva (inclui o evento na Agenda do Google, o financeiro e o estoque ligados), e procurar/apagar eventos "Lumi · ..." sobrando na Agenda. Também há "Apagar de vez" nas vendas do Caixa e "Excluir este insumo". Para reservas reais use "Cancelar reserva" (o dinheiro já recebido continua no Financeiro; para devolver, lance "Reembolso de cliente").

**Pix no Caixa:** ao escolher Pix aparece o QR Code; a venda só é registrada depois de "Pagamento confirmado".

**Acrescentar itens a uma reserva:** botão "Acrescentar itens" nos cartões da Agenda e dos Pacotes; vira uma venda do Caixa ligada à reserva (não muda o pacote nem o sinal).

**Pacote vendido no Caixa:** cria o pacote na aba Pacotes com as sessões sem data (para marcar como realizadas); o dinheiro entra uma vez, pela venda.

**Valor por minuto (Caixa):** acompanha as sessões do catálogo (interpola entre elas e arredonda ao real). Passou da maior sessão, soma a taxa do último trecho.

**CMV:** custo do material (ficha técnica × custo dos insumos) ÷ preço. Faixa desejada: 25% a 30%. O sistema só sugere preço, nunca altera.

## Arquivos deste repositório

- `index.html`, `app.js`, `style.css` — site da cliente
- `admin.html`, `admin.js` — painel (núcleo: pendentes, agenda, pacotes, bloqueios)
- `admin-catalogo.js`, `admin-estoque.js`, `admin-financeiro.js`, `admin-caixa.js` — abas do painel (cada uma se pluga em `admin.js`)
- `REGRAS.md` — regras do negócio explicadas
- `api.js`, `config.js` — comunicação com o Apps Script (`config.js` guarda só o endereço público do Web App)
- `vendor/qrcode.min.js` — gerador do QR Code do Pix

## Planilha (abas criadas e usadas pelo back-end)

`Catalogo`, `Config`, `Reservas`, `Sessoes`, `Bloqueios`, `Promocoes`, `Clientes`, `Insumos`, `FichaTecnica`, `MovEstoque`, `Lancamentos`, `VendasLocal`.

Observações importantes:
- A planilha usa o idioma **português do Brasil**: ponto é separador de milhar. Texto como `0.065` vira `65` e `1.5` vira uma data. As abas de estoque/financeiro gravam decimais como número; `Config` e `Promocoes` são formatadas como texto.
- `Config`, `Catalogo` e `Promocoes` ficam em **cache por 3 minutos**. Salvar pelo painel limpa o cache na hora; se editar a planilha na mão e quiser ver já, rode a função `limparCache` no editor do Apps Script.

## Segredos (não ficam no código nem neste repositório)

Ficam em **Apps Script → Configurações do projeto → Propriedades do script**:

- `ADMIN_PASSWORD` — senha do painel (5 erros seguidos bloqueiam por 15 minutos)
- `GEMINI_API_KEY` — (Etapa 2.3, assistente com IA) deve ser colada ali pela própria dona do projeto, nunca no código

## Como publicar mudanças

- **Back-end:** `clasp push` e depois `clasp deploy -i <ID da implantação>` (mantém o mesmo endereço do Web App).
- **Site:** enviar os arquivos para este repositório (GitHub Pages publica sozinho em alguns instantes). O navegador guarda o JS por até ~10 minutos; recarregar com Cmd+Shift+R.

## Regras que não devem ser mudadas sem combinar com a dona

Preços do catálogo, sinal de 50% por Pix, confirmação pela Stephanie e as regras de atendimento exibidas à cliente.
