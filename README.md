# Study Scroll

Site mobile-first para transformar scrolling passivo em estudo ativo, com feed vertical, perguntas objetivas e repeticao espacada.

## O que ele faz

- Abre direto no feed de estudo.
- Mostra primeiro o que esta pendente de revisao.
- Depois mostra o conteudo novo.
- Guarda progresso, historico e proximas revisoes no proprio aparelho.
- Importa arquivos `.txt` ou `.json` com o modelo estruturado.
- Exporta backup completo para restaurar em outro aparelho.
- Funciona offline depois do primeiro carregamento por causa do service worker.

## Stack

- HTML + CSS + JavaScript puro
- Armazenamento local via `localStorage`
- Importacao de arquivo via input nativo do navegador
- Backup via download ou compartilhamento do proprio navegador
- PWA leve para uso no celular

## Arquitetura

A estrutura foi pensada para ser a forma mais simples de colocar no GitHub e usar no celular:

- `index.html` carrega tudo.
- `styles.css` cuida do visual mobile-first.
- `src/app.js` orquestra o fluxo.
- `src/importer.js` interpreta o modelo do arquivo.
- `src/feed.js` monta a fila de estudo.
- `src/scheduler.js` calcula a repeticao espacada.
- `src/storage.js` persiste estado e backup.
- `src/ui.js` renderiza a interface.

Escolhi essa abordagem porque ela elimina build, backend e login. Para uso pessoal, isso reduz falhas, simplifica o deploy no GitHub Pages e deixa o site leve o suficiente para rodar bem no celular.

## Como usar

1. Abra o site.
2. Toque no menu.
3. Importe seu arquivo de estudo.
4. Estude deslizando para cima.
5. Responda as perguntas.
6. Exporte backup quando quiser.

## Como rodar localmente

Abra o `index.html` em um servidor simples. Se quiser, use qualquer servidor estatico.

Exemplo com Node:

```bash
npx serve .
```

Ou no Python:

```bash
python -m http.server 8000
```

## Formato do arquivo de estudo

O site usa o formato em JSON abaixo, que foi o modelo que voce enviou:

```json
{
  "titulo": "O Modernismo Brasileiro",
  "descricao": "Material de estudo ativo sobre o Modernismo Brasileiro.",
  "conteudo": [
    {
      "id": "mod1",
      "trecho": "Texto curto do estudo.",
      "perguntas": [
        {
          "id": "q1",
          "tipo": "multipla_escolha",
          "pergunta": "Pergunta objetiva?",
          "alternativas": [
            { "id": "A", "texto": "Opcao A" },
            { "id": "B", "texto": "Opcao B" }
          ],
          "resposta_correta": "B",
          "explicacao": "Explicacao curta."
        }
      ]
    }
  ]
}
```

## Exemplo

O exemplo pratico esta em:

- [examples/modernismo_brasileiro_estudo.json](examples/modernismo_brasileiro_estudo.json)

## Backup

O backup exportado guarda:

- conteudos importados;
- progresso por pergunta;
- historico de respostas;
- niveis de dominio;
- datas de revisao.

## GitHub Pages

Depois de subir o repositorio, aponte o GitHub Pages para a branch principal. Como o site usa caminhos relativos, ele funciona bem no dominio do GitHub Pages.
