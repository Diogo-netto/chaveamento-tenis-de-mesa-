// Constantes
const CATEGORIA_EXEMPLO = "Absoluto Masculino"; 
const MINIMO_ATLETAS = 4; 
const PONTUACAO_INICIAL_FMTM = 250;
// REMOÇÃO DE PONTOS_POR_FASE FIXO

// NOVAS CONSTANTES PARA CÁLCULO DE ELO SIMPLIFICADO (CBTM/ITTF)
const K_FACTOR = 16; 
const TAXA_CONVERSAO_ELO = 400; 

const CREDENCIAIS = { user: 'admin', pass: '123456' };

// Variáveis Globais de Estado
let atletasPorCategoria = {};
let gruposDoTorneio = [];
let eliminatoriasPartidas = {}; 
let rankingFMTM = {}; // Para armazenar o rating de cada atleta
let torneioAtivo = false;

// Referências de Elementos
const mainApp = document.getElementById('mainApp');
const loginPage = document.getElementById('loginPage');
const loginForm = document.getElementById('loginForm');
const cadastroForm = document.getElementById('cadastroForm');
const iniciarTorneioBtn = document.getElementById('iniciarTorneioBtn');
const listaAtletasDiv = document.getElementById('listaAtletas');
const contadorAbsolutoSpan = document.getElementById('contadorAbsoluto');
const statusTorneioP = document.getElementById('statusTorneio');
const faseDeGruposDiv = document.getElementById('faseDeGrupos');
const chaveamentoContainer = document.getElementById('chaveamentoContainer');
const btnGrupos = document.getElementById('btnGrupos');
const btnEliminatorias = document.getElementById('btnEliminatorias');
const avancarParaEliminatoriasBtn = document.getElementById('avancarParaEliminatoriasBtn');


// ==========================================================
// 0. FUNÇÕES DE INICIALIZAÇÃO, LOGIN E PERSISTÊNCIA
// ==========================================================

function renderizarFaseDeGrupos(grupos) {
    // ... (Código de renderização dos grupos) ...
    
    // ADIÇÃO AO FINAL DE renderizarFaseDeGrupos
    const gruposCalculados = grupos.filter(g => g.resultados !== null);
    if (grupos.length > 0 && gruposCalculados.length === grupos.length) {
        // avancarParaEliminatoriasBtn.disabled = false; // Removido pois usamos btnEliminatorias
        iniciarTorneioBtn.disabled = true; 
    } else {
        // avancarParaEliminatoriasBtn.disabled = true; // Removido pois usamos btnEliminatorias
    }
    // Lógica de desativação/ativação do botão de eliminatórias foi movida para verificarFimDosGrupos
}


function avancarParaEliminatorias() {
    verificarFimDosGrupos();
    openTab('eliminatorias');
}


window.avancarParaEliminatorias = avancarParaEliminatorias; // Torna global
function resetSystem() {
    if (!confirm("ATENÇÃO: Você tem certeza que deseja ZERAR O SISTEMA? Todos os dados do torneio (atletas, grupos, resultados e ranking) serão PERDIDOS!")) {
        return;
    }

    // 1. Limpa o localStorage do torneio e do login
    localStorage.removeItem('torneioData');
    sessionStorage.removeItem('loggedIn'); 

    // 2. Reseta as variáveis de estado globais para o padrão (opcional, mas bom para limpeza)
    atletasPorCategoria = {};
    gruposDoTorneio = [];
    eliminatoriasPartidas = {}; 
    rankingFMTM = {}; 
    torneioAtivo = false;

    // 3. Força a recarga da página para aplicar o estado inicial limpo
    alert("Sistema zerado com sucesso. Recarregando...");
    window.location.reload();
}
window.resetSystem = resetSystem; // Torna global para o HTML

document.addEventListener('DOMContentLoaded', () => {
    carregarDados();
    // Verifica se o usuário já fez login (simulação simples)
    if (sessionStorage.getItem('loggedIn') === 'true') {
        showApp();
    } else {
        showLogin();
    }
});

function showLogin() {
    loginPage.classList.remove('hidden');
    mainApp.classList.add('hidden');
}

function showApp() {
    loginPage.classList.add('hidden');
    mainApp.classList.remove('hidden');
    verificarStatusTorneio();
    if (torneioAtivo) {
        renderizarFaseDeGrupos(gruposDoTorneio);
        renderizarChaveamento();
    }
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const loginError = document.getElementById('loginError');

    if (user === CREDENCIAIS.user && pass === CREDENCIAIS.pass) {
        sessionStorage.setItem('loggedIn', 'true');
        loginError.textContent = '';
        showApp();
    } else {
        loginError.textContent = 'Credenciais inválidas.';
    }
});

function doLogout() {
    sessionStorage.removeItem('loggedIn');
    showLogin();
}

function salvarDados() {
    // Refatorando o ranking para salvar apenas o essencial (nome, id, pontuacao, historico)
    const rankingParaSalvar = {};
    for (const id in rankingFMTM) {
        rankingParaSalvar[id] = {
            id: rankingFMTM[id].id,
            nome: rankingFMTM[id].nome,
            pontuacao: rankingFMTM[id].pontuacao,
            historico: rankingFMTM[id].historico,
            
        };
        // Remove a pontuação temporária do torneio atual (pontosTorneioAtual) antes de salvar permanentemente
        delete rankingFMTM[id].pontosTorneioAtual; 
    }
    
    const data = {
        atletasPorCategoria,
        gruposDoTorneio,
        eliminatoriasPartidas,
        ranking: rankingParaSalvar, // Apenas o ranking limpo
        torneioAtivo
    };
    localStorage.setItem('torneioData', JSON.stringify(data));
    verificarFimDosGrupos(); 
}

function carregarDados() {
    const data = JSON.parse(localStorage.getItem('torneioData') || '{}');
    if (data.atletasPorCategoria) atletasPorCategoria = data.atletasPorCategoria;
    if (data.gruposDoTorneio) gruposDoTorneio = data.gruposDoTorneio;
    if (data.eliminatoriasPartidas) eliminatoriasPartidas = data.eliminatoriasPartidas;
    if (data.ranking) {
        rankingFMTM = data.ranking;
        // Inicializa a pontuação de ganhos do torneio atual em zero ao carregar
        for (const id in rankingFMTM) {
             rankingFMTM[id].pontosTorneioAtual = 0; 
        }
    }
    if (data.torneioAtivo !== undefined) torneioAtivo = data.torneioAtivo;
    
    // Inicializa o ranking para novos atletas
    inicializarRanking();
    
    verificarStatusTorneio();
}

// Download de JSON para simular o "salvar no computador"
function downloadJSON() {
    salvarDados(); // Salva primeiro o estado atual
    // Apenas o ranking e os dados de torneio são salvos (já filtrados em salvarDados)
    const dataStr = JSON.stringify(JSON.parse(localStorage.getItem('torneioData')), null, 2); 
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    let link = document.createElement('a');
    link.href = dataUri;
    link.download = `dados_torneio_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert("Dados do torneio salvos com sucesso no seu computador (pasta de downloads)!");
}
window.downloadJSON = downloadJSON; // Torna global para o HTML

function inicializarRanking() {
    // Garante que cada atleta tenha uma entrada no ranking com 250 pontos iniciais
    for (const categoria in atletasPorCategoria) {
        atletasPorCategoria[categoria].forEach(atleta => {
            if (!rankingFMTM[atleta.id]) {
                rankingFMTM[atleta.id] = {
                    id: atleta.id,
                    nome: atleta.nome,
                    
                   
                    
                };
            }
            // Atualiza o rating do atleta na lista se o ranking for mais recente
            if (rankingFMTM[atleta.id] && rankingFMTM[atleta.id].pontuacao !== atleta.rating) {
                 atleta.rating = rankingFMTM[atleta.id].pontuacao;
            }
        });
    }
}

// Função de utilidade para trocar abas
function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[onclick="openTab('${tabName}')"]`).classList.add('active');
}
window.openTab = openTab;


// ==========================================================
// 1. LÓGICA DE CADASTRO
// ==========================================================

cadastroForm.addEventListener('submit', cadastrarAtleta);
iniciarTorneioBtn.addEventListener('click', iniciarTorneio);

function cadastrarAtleta(e) {
    e.preventDefault();
    if (torneioAtivo) {
        alert("Torneio em andamento. Não é permitido cadastrar mais atletas.");
        return;
    }

    const nome = document.getElementById('nomeAtleta').value.trim();
    const categoria = document.getElementById('categoria').value;
    
    if (!nome || !categoria) return;
    
    if (!atletasPorCategoria[categoria]) {
        atletasPorCategoria[categoria] = [];
    }
    
    const novoAtleta = { 
        nome: nome, 
        id: 'A' + Date.now() + Math.floor(Math.random() * 1000), 
        // Inicializa o rating com o valor de PONTUACAO_INICIAL_FMTM (250)
        rating: PONTUACAO_INICIAL_FMTM, 
        clube: `Clube ${Math.floor(Math.random() * 5) + 1}` 
    };
    
    atletasPorCategoria[categoria].push(novoAtleta); 
    
    document.getElementById('nomeAtleta').value = '';
    
    // Atualiza ranking e salva
    inicializarRanking(); 
    salvarDados();
    verificarStatusTorneio();
}

function atualizarListaAtletas() {
    listaAtletasDiv.innerHTML = '';
    let totalAbsoluto = 0;

    for (const categoria in atletasPorCategoria) {
        if (atletasPorCategoria[categoria].length > 0) {
            const categoriaHeader = document.createElement('h4');
            categoriaHeader.textContent = `${categoria} (${atletasPorCategoria[categoria].length} atletas)`;
            listaAtletasDiv.appendChild(categoriaHeader);

            // Garante que o rating exibido seja o do rankingFMTM
            atletasPorCategoria[categoria].forEach(atleta => {
                if(rankingFMTM[atleta.id]) {
                    atleta.rating = rankingFMTM[atleta.id].pontuacao;
                }
            });
            
            const atletasOrdenados = atletasPorCategoria[categoria].sort((a, b) => b.rating - a.rating);

            atletasOrdenados.forEach((atleta, index) => {
                const p = document.createElement('p');
                p.textContent = `${index + 1}. ${atleta.nome} (R: ${atleta.rating}) - ${atleta.clube}`;
                listaAtletasDiv.appendChild(p);
            });
            
            if (categoria === CATEGORIA_EXEMPLO) {
                totalAbsoluto = atletasPorCategoria[categoria].length;
            }
        }
    }
    return totalAbsoluto;
}

function verificarStatusTorneio() {
    const totalAbsoluto = atualizarListaAtletas();
    contadorAbsolutoSpan.textContent = totalAbsoluto;

    if (totalAbsoluto >= MINIMO_ATLETAS && !torneioAtivo) {
        iniciarTorneioBtn.disabled = false;
        statusTorneioP.textContent = `Pronto! ${totalAbsoluto} atletas cadastrados.`;
        statusTorneioP.style.color = 'green';
    } else if (torneioAtivo) {
        iniciarTorneioBtn.disabled = true;
        statusTorneioP.textContent = `Torneio em andamento!`;
        statusTorneioP.style.color = 'blue';
    } else {
        iniciarTorneioBtn.disabled = true;
        statusTorneioP.textContent = `Cadastre pelo menos ${MINIMO_ATLETAS} atletas.`;
        statusTorneioP.style.color = 'orange';
    }
    
    // Atualiza o status dos botões de navegação
    verificarFimDosGrupos();
}

// ==========================================================
// 2. LÓGICA DO TORNEIO (FASE DE GRUPOS)
// ==========================================================

function iniciarTorneio() {
    // Garante que o rating de cada atleta esteja atualizado antes do sorteio
    inicializarRanking(); 
    
    const atletasAbsoluto = atletasPorCategoria[CATEGORIA_EXEMPLO]
        .sort((a, b) => b.rating - a.rating);
    
    if (atletasAbsoluto.length < MINIMO_ATLETAS) return;

    torneioAtivo = true;
    gruposDoTorneio = criarGrupos(atletasAbsoluto);
    renderizarFaseDeGrupos(gruposDoTorneio);
    
    salvarDados();
    verificarStatusTorneio();
    openTab('grupos');
}

/**
 * Lógica CBTM/ITTF: Grupos de 3 ou 4.
 */
function criarGrupos(atletas) {
    const N = atletas.length;
    let numGrupos = 1;
    
    // Determina o número de grupos
    if (N >= 7) { 
        numGrupos = Math.round(N / 4);
        if (Math.floor(N / numGrupos) < 3) { // Garante mínimo de 3 por grupo
            numGrupos = Math.floor(N / 3);
        }
    } else if (N >= 4) {
        numGrupos = 1;
    } else {
        // Se for muito pequeno, forçamos a chave eliminatória direta.
        gerarChaveamentoDireto(atletas);
        return [];
    }

    let grupos = Array.from({ length: numGrupos }, (_, i) => ({
        atletas: [], 
        partidas: [],
        nome: `Grupo ${String.fromCharCode(65 + i)}`,
        resultados: null, // Mudar para null, será um array de stats no final
    }));
    
    const atletasDisponiveis = [...atletas];
    
    // Distribuição por rating (Cabeças de Chave) - Sistema "Serpente"
    for(let i = 0; atletasDisponiveis.length > 0; i++) {
        const atleta = atletasDisponiveis.shift();
        let grupoIndex = i % numGrupos;
        
        // Simulação de distribuição Snake
        if (Math.floor(i / numGrupos) % 2 !== 0) { // Se for um round de distribuição "de volta"
            grupoIndex = numGrupos - 1 - grupoIndex;
        }
        
        grupos[grupoIndex].atletas.push(atleta);
    }
    
    // Gera as partidas (Melhor de 5 sets - 3 sets para vencer)
    grupos.forEach(grupo => {
        grupo.partidas = gerarPartidasTodosContraTodos(grupo.atletas);
    });

    return grupos;
}

function gerarPartidasTodosContraTodos(atletas) {
    const partidas = [];
    for (let i = 0; i < atletas.length; i++) {
        for (let j = i + 1; j < atletas.length; j++) {
            partidas.push({
                id: `${atletas[i].id}-${atletas[j].id}`,
                j1: atletas[i],
                j2: atletas[j],
                // Sets é melhor de 5. Se for 3x0 ou 3x1 ou 3x2, alguém vence
                resultado: '0x0', 
            });
        }
    }
    return partidas;
}

function renderizarFaseDeGrupos(grupos) {
    faseDeGruposDiv.innerHTML = grupos.length === 0 ? '<p>Fase de Grupos não aplicável ou gerada.</p>' : '';
    
    grupos.forEach((grupo) => {
        const grupoDiv = document.createElement('div');
        grupoDiv.classList.add('grupo-card');
        grupoDiv.setAttribute('data-name', grupo.nome);
        
        let atletasTableHtml = `
            <table>
                <thead>
                    <tr><th>#</th><th>JOGADOR</th><th>Rating</th><th>Status</th></tr>
                </thead>
                <tbody>
        `;
        
        const atletasExibidos = grupo.resultados ? grupo.resultados : grupo.atletas.sort((a, b) => b.rating - a.rating);

        atletasExibidos.forEach((atleta, index) => {
             // Usa o resultado se estiver disponível, senão usa a ordem de rating
             const nomeAtleta = atleta.nome;
             // Garante que o rating seja o atualizado no ranking
             const rating = rankingFMTM[atleta.id] ? rankingFMTM[atleta.id].pontuacao : (atleta.rating || 0); 
             let status = 'Aguardando...';

             if(grupo.resultados) {
                 status = (index === 0 || index === 1) ? 'Classificado' : 'Eliminado';
             }

             atletasTableHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${nomeAtleta}</td>
                    <td>${rating}</td>
                    <td style="color:${status === 'Classificado' ? 'green' : (status === 'Eliminado' ? 'red' : 'inherit')}">${status}</td>
                </tr>
             `;
        });
        atletasTableHtml += `</tbody></table>`;
        
        let partidasHtml = '';
        grupo.partidas.forEach(partida => {
            partidasHtml += `
                <div class="match">
                    <span class="j-name">${partida.j1.nome}</span> 
                    <input type="text" id="res-${partida.id}" value="${partida.resultado}" 
                        placeholder="Sets J1 x Sets J2 (Ex: 3x0)" size="10">
                    <span class="j-name" style="text-align: right;">${partida.j2.nome}</span>
                </div>
            `;
        });
        
        const isCalculated = grupo.resultados !== null;
        
        // Exibe o resumo da classificação
        let classificacaoContent = 'Aguardando Classificação...';
        if (isCalculated) {
            classificacaoContent = '<strong>Classificação Final:</strong><br>';
            grupo.resultados.forEach((atleta, index) => {
                classificacaoContent += `(${index + 1}º) ${atleta.nome} | V:${atleta.vitorias} | SS: ${atleta.setsVencidos}-${atleta.setsPerdidos} <br>`;
            });
        }
        
        grupoDiv.innerHTML = `
            <h4>${CATEGORIA_EXEMPLO.toUpperCase()} - ${grupo.nome} (${grupo.atletas.length} Atletas)</h4>
            ${atletasTableHtml}
            <div style="padding: 10px;">
                <p><strong>Partidas:</strong> (Melhor de 5 sets)</p>
                <div id="partidas-${grupo.nome}">${partidasHtml}</div>
            </div>
            <div class="classificacao">${classificacaoContent}</div>
            <button class="calcular-btn" onclick="calcularClassificacao('${grupo.nome}')" ${isCalculated ? 'disabled' : ''}>Calcular Classificação</button>
        `;
        faseDeGruposDiv.appendChild(grupoDiv);
    });
}
window.calcularClassificacao = calcularClassificacao; // Torna global

function calcularClassificacao(nomeGrupo) {
    const grupo = gruposDoTorneio.find(g => g.nome === nomeGrupo);
    if (!grupo) return;

    let todosResultadosPreenchidos = true;
    grupo.partidas.forEach(partida => {
        const input = document.getElementById(`res-${partida.id}`);
        partida.resultado = input.value.trim().toLowerCase();
        
        // Verifica se está no formato SetsVencidosXSetsPerdidos e se alguém fez 3 sets
        const [setsJ1, setsJ2] = partida.resultado.split('x').map(s => parseInt(s));
        if (!/^\d+x\d+$/.test(partida.resultado) || isNaN(setsJ1) || isNaN(setsJ2) || (setsJ1 < 3 && setsJ2 < 3) || (setsJ1 > 3 && setsJ2 > 3)) {
             todosResultadosPreenchidos = false;
        }
    });


    

    if (!todosResultadosPreenchidos) {
        alert("Erro: Preencha todos os resultados corretamente no formato SetsVencidosXSetsPerdidos (Ex: 3x0, 3x2). O vencedor deve ter 3 sets.");
        return;
    }

    const estatisticas = {};
    grupo.atletas.forEach(atleta => {
        // Usa o rating ATUAL do rankingFMTM
        const ratingAtual = rankingFMTM[atleta.id] ? rankingFMTM[atleta.id].pontuacao : atleta.rating;
        estatisticas[atleta.id] = { nome: atleta.nome, vitorias: 0, setsVencidos: 0, setsPerdidos: 0, rating: ratingAtual, id: atleta.id };
    });

    // Lógica de contagem de sets e vitórias e APLICAÇÃO DO ELO
    grupo.partidas.forEach(partida => {
        const [setsJ1, setsJ2] = partida.resultado.split('x').map(s => parseInt(s));
        
        const statsJ1 = estatisticas[partida.j1.id];
        const statsJ2 = estatisticas[partida.j2.id];

        statsJ1.setsVencidos += setsJ1;
        statsJ1.setsPerdidos += setsJ2;
        statsJ2.setsVencidos += setsJ2;
        statsJ2.setsPerdidos += setsJ1;

        let vencedorId = null;
        if (setsJ1 > setsJ2) {
            statsJ1.vitorias += 1;
            vencedorId = partida.j1.id;
        } else if (setsJ2 > setsJ1) {
            statsJ2.vitorias += 1;
            vencedorId = partida.j2.id;
        }
        
        // NOVO: APLICAÇÃO DO ELO APÓS CADA PARTIDA DA FASE DE GRUPOS
        if (vencedorId) {
             const perdedorId = vencedorId === partida.j1.id ? partida.j2.id : partida.j1.id;
             atualizarRankingElo(vencedorId, perdedorId); // Aplica a mudança de ELO
        }
    });
    
    let listaClassificacao = Object.values(estatisticas);

    // CRITÉRIOS DE DESEMPATE CBTM/ITTF:
    // 1. Número de Vitórias (V)
    // 2. Saldo de Sets (SS)
    // 3. Rating (para desempate final)
    listaClassificacao.sort((a, b) => {
        if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias; 
        
        const saldoSetsA = a.setsVencidos - a.setsPerdidos;
        const saldoSetsB = b.setsVencidos - b.setsPerdidos;
        if (saldoSetsB !== saldoSetsA) return saldoSetsB - saldoSetsA; 
        
        // Garante que o rating usado para desempate seja o mais atual
        const ratingA = rankingFMTM[a.id] ? rankingFMTM[a.id].pontuacao : a.rating;
        const ratingB = rankingFMTM[b.id] ? rankingFMTM[b.id].pontuacao : b.rating;
        return ratingB - ratingA; // Desempate final pelo Rating CBTM/FMTM
    });
    
    grupo.resultados = listaClassificacao;
    
    // REMOVEMOS: A atribuição de pontuação por eliminação fixa. A pontuação é por ELO.

    renderizarFaseDeGrupos(gruposDoTorneio);
    salvarDados();
}

function verificarFimDosGrupos() {
    const gruposCalculados = gruposDoTorneio.filter(g => g.resultados !== null);
    
    // Verifica se o torneio está ativo E se há grupos para calcular
    if (torneioAtivo) {
        btnGrupos.disabled = false; // Garante que Grupos esteja navegável
    } else {
        btnGrupos.disabled = true;
    }
    
    // Verifica se todos os grupos foram calculados
    if (gruposDoTorneio.length > 0 && gruposCalculados.length === gruposDoTorneio.length) {
        
        // Se a chave eliminatória ainda não foi iniciada, gere AGORA
        if (Object.keys(eliminatoriasPartidas).length === 0) {
            gerarChaveamentoFinal();
        }
        
        btnEliminatorias.disabled = false;

    } else {
        // Se não terminou, desabilita a chave eliminatória
        btnEliminatorias.disabled = true;
    }
}

// ==========================================================
// 3. LÓGICA DO CHAVEAMENTO ELIMINATÓRIO (CBTM)
// ==========================================================

function gerarChaveamentoDireto(atletas) {
    const numParticipantes = atletas.length;
    let powerOfTwo = 2;
    while (powerOfTwo < numParticipantes) {
        powerOfTwo *= 2;
    }
    const vagasLivres = powerOfTwo - numParticipantes;
    // Garante que a ordenação seja pelo rating ATUALIZADO do ranking
    const atletasOrdenados = atletas.sort((a, b) => {
        const ratingA = rankingFMTM[a.id] ? rankingFMTM[a.id].pontuacao : a.rating;
        const ratingB = rankingFMTM[b.id] ? rankingFMTM[b.id].pontuacao : b.rating;
        return ratingB - ratingA;
    });

    let finalSeed = criarChaveComByes(atletasOrdenados.slice(0, vagasLivres), atletasOrdenados.slice(vagasLivres), powerOfTwo);
    
    iniciarFaseEliminatoria(finalSeed);
    openTab('eliminatorias');
    btnEliminatorias.disabled = false;
    btnGrupos.disabled = true;
    salvarDados();
}


// ==================================================================
// FUNÇÃO MODIFICADA PARA O CRUZAMENTO OLÍMPICO
// ==================================================================
function gerarChaveamentoFinal() {
    // 1. Validação inicial
    if (gruposDoTorneio.length === 0 || !gruposDoTorneio.every(g => g.resultados)) {
        console.error("Não é possível gerar a chave. Nem todos os grupos foram calculados.");
        return;
    }

    // Lógica específica para o cruzamento de 2 grupos (A e B)
    if (gruposDoTorneio.length === 2) {
        const grupoA = gruposDoTorneio.find(g => g.nome === 'Grupo A');
        const grupoB = gruposDoTorneio.find(g => g.nome === 'Grupo B');

        if (!grupoA || !grupoB || grupoA.resultados.length < 2 || grupoB.resultados.length < 2) {
            alert("Erro: Para o cruzamento, os Grupos A e B devem ter pelo menos 2 classificados cada.");
            return;
        }

        const primeiroA = grupoA.resultados[0];
        const segundoA = grupoA.resultados[1];
        const primeiroB = grupoB.resultados[0];
        const segundoB = grupoB.resultados[1];
        
        // 2. Monta a semente (seed) da chave com o cruzamento correto
        // Semifinal 1: 1º do A vs. 2º do B
        // Semifinal 2: 1º do B vs. 2º do A
        const finalSeed = [
            primeiroA,
            segundoB,
            primeiroB, 
            segundoA
        ];

        // 3. Inicia a fase eliminatória com a semente correta
        if (Object.keys(eliminatoriasPartidas).length === 0) {
            iniciarFaseEliminatoria(finalSeed);
        }
        
        salvarDados();
        renderizarChaveamento();

    } else {
        // MANTÉM A LÓGICA ANTIGA PARA CASOS COM MAIS DE 2 GRUPOS (OU 1 GRUPO)
        // Onde a ordenação por rating global faz mais sentido.
        console.warn("A lógica de cruzamento automático só funciona para 2 grupos. Usando chaveamento padrão por rating.");
        
        let todosClassificados = [];
        gruposDoTorneio.forEach(grupo => {
            if (grupo.resultados && grupo.resultados.length >= 2) {
                 // Pega apenas os 2 primeiros de cada grupo
                 todosClassificados.push(grupo.resultados[0]); 
                 todosClassificados.push(grupo.resultados[1]);
            }
        });
        
        todosClassificados.sort((a, b) => {
            const ratingA = rankingFMTM[a.id] ? rankingFMTM[a.id].pontuacao : a.rating;
            const ratingB = rankingFMTM[b.id] ? rankingFMTM[b.id].pontuacao : b.rating;
            return ratingB - ratingA;
        });
        
        const numParticipantes = todosClassificados.length;
        if (numParticipantes === 0) return;
        
        let powerOfTwo = 2;
        while (powerOfTwo < numParticipantes) {
            powerOfTwo *= 2;
        }

        const vagasLivres = powerOfTwo - numParticipantes;
        
        let finalSeed = [];
        if (vagasLivres > 0) {
            finalSeed = criarChaveComByes(todosClassificados.slice(0, vagasLivres), todosClassificados.slice(vagasLivres), powerOfTwo);
        } else {
            finalSeed = todosClassificados; 
        }
        
        if (Object.keys(eliminatoriasPartidas).length === 0) {
            iniciarFaseEliminatoria(finalSeed);
        }
        
        salvarDados();
        renderizarChaveamento();
    }
}

/**
 * LÓGICA CRUCIAL CBTM/ITTF: Distribuição de seeds e Byes.
 * * seedsComBye: Atletas que ganham o BYE (Top Ratings).
 * atletasSemBye: Atletas que jogam a 1ª rodada.
 * powerOfTwo: Tamanho final da chave (ex: 8, 16).
 */
function criarChaveComByes(seedsComBye, atletasSemBye, powerOfTwo) {
    const finalChave = Array(powerOfTwo).fill(null);
    const totalByes = seedsComBye.length;
    
    // 1. Aloca os atletas que ganham BYE e o próprio BYE.
    for (let i = 0; i < totalByes; i++) {
        const atletaComBye = seedsComBye[i];
        
        let posAtleta;
        let posBye;

        // Regra de distribuição de Seeds simplificada (para garantir que separem os melhores):
        // Seed 1: 1ª posição (finalChave[0])
        // Seed 2: Última posição (finalChave[N-1])
        // Seed 3: Posição N/2 (finalChave[N/2 - 1])
        // Seed 4: Posição (N/2 + 1) (finalChave[N/2])
        // ... e seus BYEs são posicionados para que eles avancem automaticamente
        
        // Implementação simplificada de seeding, focando apenas nos BYEs:
        // A ITTF usa uma tabela de distribuição fixa para posicionar seeds (Top 8 ou Top 16)
        // A lógica abaixo garante que os BYEs sejam sempre pareados com um Seed e preencham os slots nulos.

        // Para i=0 (Seed 1), i=1 (Seed 2), i=2 (Seed 3), etc.
        if (i === 0) { // Seed 1
             posAtleta = 0; posBye = 1;
        } else if (i === 1) { // Seed 2
             posAtleta = powerOfTwo - 1; posBye = powerOfTwo - 2;
        } else if (i === 2) { // Seed 3
             posAtleta = powerOfTwo / 2 - 1; posBye = powerOfTwo / 2;
        } else if (i === 3) { // Seed 4
             posAtleta = powerOfTwo / 2; posBye = powerOfTwo / 2 + 1;
        } else if (i % 2 === 0) { // Demais seeds ímpares no topo
             posAtleta = i; posBye = i + 1;
        } else { // Demais seeds pares no fundo (invertido)
             posAtleta = powerOfTwo - 1 - (i); posBye = posAtleta - 1;
        }


        // Coloca o Seed e o BYE para que o Seed avance
        if (posAtleta >= 0 && posAtleta < powerOfTwo && posBye >= 0 && posBye < powerOfTwo) {
            // Garante que não sobrescreva um slot já preenchido (se a lógica de pos estiver errada)
            if (finalChave[posAtleta] === null) finalChave[posAtleta] = atletaComBye;
            if (finalChave[posBye] === null) finalChave[posBye] = { nome: "BYE", id: "BYE" + posBye, rating: 0 };
        }
    }

    // 2. Aloca os atletas restantes (Sem BYE) nos slots nulos restantes, mantendo a ordem de rating.
    let atletasSemByeDisponiveis = [...atletasSemBye];
    for (let i = 0; i < powerOfTwo; i++) {
        if (finalChave[i] === null) {
            finalChave[i] = atletasSemByeDisponiveis.shift() || { nome: "VAGA VAZIA", id: "VAZIA" + i, rating: 0 };
        }
    }
    
    // Filtra apenas jogadores e BYEs (remove vagas vazias se houver algum erro de lógica)
    return finalChave.filter(a => a && a.nome !== "VAGA VAZIA"); 
}


function iniciarFaseEliminatoria(finalSeed) {
    eliminatoriasPartidas = {};
    
    let jogadoresFaseAtual = finalSeed;
    let partidasFaseAtual = [];
    let powerOfTwo = jogadoresFaseAtual.length;

    // 1. Constrói a PRIMEIRA fase (com confrontos e BYEs)
    let nomeFaseAtual = getNomeFase(powerOfTwo);
    
    for (let i = 0; i < powerOfTwo; i += 2) {
        const p1 = jogadoresFaseAtual[i];
        const p2 = jogadoresFaseAtual[i + 1];
        
        const isBye = (p1.nome.startsWith("BYE") || p2.nome.startsWith("BYE"));
        const idPartida = `${nomeFaseAtual.replace(/\s/g, '')}-${i / 2 + 1}`;
        
        const partida = {
            id: idPartida,
            fase: nomeFaseAtual,
            jogadores: [p1, p2],
            resultado: isBye ? (p1.nome.startsWith("BYE") ? [0, 3] : [3, 0]) : [null, null],
            vencedorId: isBye ? (p1.nome.startsWith("BYE") ? p2.id : p1.id) : null,
            proximaPartidaId: null, 
            slotProximaPartida: null,
            dataHoraLocal: simularDataHoraMesa(powerOfTwo, i / 2 + 1),
        };
        
        partidasFaseAtual.push(partida);
        eliminatoriasPartidas[idPartida] = partida;
    }
    
    // 2. Constrói as fases seguintes (Quartas, Semifinal, Final)
    let numPartidasNaFase = partidasFaseAtual.length;
    let faseIndex = 1;

    while (numPartidasNaFase > 1) {
        const proximaFasePartidas = [];
        const nomeProximaFase = getNomeFase(numPartidasNaFase);
        
        for (let i = 0; i < numPartidasNaFase / 2; i++) {
            const idPartida = `${nomeProximaFase.replace(/\s/g, '')}-${i + 1}`;
            const partida = {
                id: idPartida,
                fase: nomeProximaFase,
                jogadores: [null, null],
                resultado: [null, null],
                vencedorId: null,
                proximaPartidaId: null,
                slotProximaPartida: null,
                dataHoraLocal: simularDataHoraMesa(numPartidasNaFase, i + 1),
            };
            proximaFasePartidas.push(partida);
            eliminatoriasPartidas[idPartida] = partida;
        }

        for (let i = 0; i < partidasFaseAtual.length; i++) {
            const partidaAtual = partidasFaseAtual[i];
            const proximaPartida = proximaFasePartidas[Math.floor(i / 2)];
            
            partidaAtual.proximaPartidaId = proximaPartida.id;
            partidaAtual.slotProximaPartida = i % 2 === 0 ? 0 : 1; 
            
            // Avança o vencedor do BYE imediatamente
            if (partidaAtual.vencedorId) {
                avancarVencedor(partidaAtual.id, false); 
            }
        }
        
        partidasFaseAtual = proximaFasePartidas;
        numPartidasNaFase /= 2;
        faseIndex++;
    }
}

function getNomeFase(numJogadoresNaFase) {
    if (numJogadoresNaFase > 16) return `1/${numJogadoresNaFase} de Final`;
    if (numJogadoresNaFase === 16) return "Oitavas de Final";
    if (numJogadoresNaFase === 8) return "Quartas de Final";
    if (numJogadoresNaFase === 4) return "Semifinal";
    if (numJogadoresNaFase === 2) return "Final";
    return "Fase Desconhecida";
}

function simularDataHoraMesa(numJogadores, partidaIndex) {
    // Simula que chaves maiores ocorrem mais cedo
    const offset = Math.floor(Math.log2(numJogadores)); // 16 = 4, 8 = 3, 4 = 2, 2 = 1
    const data = new Date();
    data.setDate(data.getDate() + offset); 
    const hora = 17 + partidaIndex % 3; // Simula a hora na mesa
    const mesa = partidaIndex;
    
    return `${data.toLocaleDateString('pt-BR')} ${hora}:00 - M${mesa}`;
}

// ==========================================================
// 4. RENDERIZAÇÃO E INTERAÇÃO DA CHAVE
// ==========================================================

function renderizarChaveamento() {
    chaveamentoContainer.innerHTML = '';
    
    // ... (Lógica de ordenação das fases) ...
    const fases = {};
    
    Object.values(eliminatoriasPartidas).forEach(p => {
        if (!fases[p.fase]) fases[p.fase] = [];
        fases[p.fase].push(p);
    });

    const ordemFases = ["Oitavas de Final", "Quartas de Final", "Semifinal", "Final"];
    const fasesOrdenadas = Object.keys(fases).sort((a, b) => {
        // Trata fases como "1/N" para ordenar corretamente
        const indexA = ordemFases.indexOf(a);
        const indexB = ordemFases.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA === -1 && indexB === -1) {
            // Comparar N de "1/N de Final"
            const nA = parseInt(a.match(/\d+/)?.[0] || 0);
            const nB = parseInt(b.match(/\d+/)?.[0] || 0);
            return nB - nA; // Ordem decrescente de N (1/32 > 1/16)
        }
        return indexA - indexB; // Move desconhecidos para o início
    });
    
    // Renderiza cada fase em sua própria coluna
    fasesOrdenadas.forEach((nomeFase) => {
        const faseDiv = document.createElement('div');
        faseDiv.classList.add('fase-coluna');
        faseDiv.innerHTML = `<h4>${nomeFase}</h4>`;
        
        fases[nomeFase].forEach(partida => {
            const box = criarMatchBox(partida, nomeFase === "Final");
            faseDiv.appendChild(box);
        });
        chaveamentoContainer.appendChild(faseDiv);
    });
    
    // Remove o display de campeão antigo para não duplicar
    const oldCampeaoDisplay = document.querySelector('.campeao-display');
    if (oldCampeaoDisplay) oldCampeaoDisplay.remove();
}

function criarMatchBox(partida, isFinal) {
    const box = document.createElement('div');
    box.classList.add('match-box');
    box.setAttribute('data-partida-id', partida.id);

    let isLocked = partida.jogadores.some(j => j === null);
    
    // Checa se o resultado já foi preenchido e se o vencedor já foi definido
    const isPlayed = partida.vencedorId !== null;

    partida.jogadores.forEach((jogador, index) => {
        const scoreDiv = document.createElement('div');
        scoreDiv.classList.add('player-score');
        
        const nome = jogador ? jogador.nome : (isLocked ? 'Aguardando Vencedor' : 'Vaga Livre');
        const resultado = partida.resultado[index] !== null ? partida.resultado[index] : '';
        const isBye = jogador && jogador.nome.startsWith("BYE");
        
        scoreDiv.classList.toggle('bye', isBye);
        scoreDiv.classList.toggle('vencedor', !isBye && partida.vencedorId === jogador?.id);

        let nomeSpan = `<span class="player-name">${nome}</span>`;
        let placarElement;
        
        if (isBye) {
             placarElement = `<span class="score-display">BYE</span>`;
        } else if (isPlayed) {
            placarElement = `<span class="score-display">${resultado}</span>`;
        } else if (!isLocked && jogador) {
            // Resultado editável: permite input se o jogo não estiver travado e não foi jogado
            placarElement = `<input type="number" min="0" max="3" class="score-input" 
                                 data-partida-id="${partida.id}" data-slot="${index}" 
                                 value="${resultado}" onchange="registrarResultado(this)">`;
        } else {
            placarElement = `<span class="score-display"></span>`;
        }

        scoreDiv.innerHTML = nomeSpan + placarElement;
        box.appendChild(scoreDiv);
    });

    box.innerHTML += `<div class="match-details">${partida.dataHoraLocal}</div>`;

    if (isFinal && isPlayed) {
          const vencedor = partida.jogadores.find(j => j.id === partida.vencedorId);
          const perdedor = partida.jogadores.find(j => j.id !== partida.vencedorId && !j.nome.startsWith("BYE"));
          
          if (vencedor) {
               // AplicarPontuacaoRanking(vencedor.id, 'Campeão'); // O ELO já foi aplicado. Apenas exibe o título
               const vencedorElement = box.querySelector(`.player-score.vencedor .player-name`);
               if (vencedorElement) vencedorElement.innerHTML += `<span style="font-size:12px; font-weight:bold;"> (1º)</span>`;
          }
          if (perdedor) {
               // AplicarPontuacaoRanking(perdedor.id, 'Vice-campeão'); // O ELO já foi aplicado. Apenas exibe o título
               const perdedorElement = box.querySelector(`.player-score:not(.vencedor):not(.bye) .player-name`);
               if (perdedorElement) perdedorElement.innerHTML += `<span style="font-size:12px;"> (2º)</span>`;
          }

          // Exibe o campeão no container
          if (!document.querySelector('.campeao-display') && vencedor) {
              chaveamentoContainer.insertAdjacentHTML('afterend', `<div class="campeao-display">🏆 CAMPEÃO: ${vencedor.nome} 🏆</div>`);
          }
    }
    
    // REMOVEMOS: A aplicação de pontuação do perdedor aqui. Ela é feita em registrarResultado (ELO).

    return box;
}

window.registrarResultado = registrarResultado; // Torna global

function registrarResultado(inputElement) {
    const id = inputElement.getAttribute('data-partida-id');
    const slot = parseInt(inputElement.getAttribute('data-slot'));
    const valor = parseInt(inputElement.value);
    const partida = eliminatoriasPartidas[id];

    if (!partida || isNaN(valor) || valor < 0 || valor > 3) {
        alert("O placar de sets deve ser um número entre 0 e 3.");
        return;
    }
    
    partida.resultado[slot] = valor;

    const [setsP1, setsP2] = partida.resultado;
    if (setsP1 !== null && setsP2 !== null) {
        if (setsP1 >= 3 || setsP2 >= 3) { 
            let vencedor = null;
            if (setsP1 > setsP2) {
                vencedor = partida.jogadores[0];
            } else if (setsP2 > setsP1) {
                vencedor = partida.jogadores[1];
            }
            
            if (vencedor) {
                partida.vencedorId = vencedor.id;
                
                // NOVO: APLICAÇÃO DO ELO APÓS CADA PARTIDA DA CHAVE
                const perdedor = partida.jogadores.find(j => j.id !== vencedor.id && !j.nome.startsWith("BYE"));
                if (perdedor) {
                    atualizarRankingElo(vencedor.id, perdedor.id);
                }

                avancarVencedor(id, true); // Avanca e salva
            } else {
                alert("O placar indica empate ou jogo inválido. O vencedor deve ter 3 sets.");
                partida.vencedorId = null;
            }
        } else {
             partida.vencedorId = null; 
        }
    }
    
    renderizarChaveamento();
    salvarDados();
}

/**
 * Move o jogador vencedor para a próxima partida na chave.
 */
function avancarVencedor(partidaId, shouldSave) {
    const partidaAtual = eliminatoriasPartidas[partidaId];
    
    if (!partidaAtual || !partidaAtual.vencedorId) return;
    
    const vencedor = partidaAtual.jogadores.find(j => j.id === partidaAtual.vencedorId);
    
    if (!partidaAtual.proximaPartidaId) {
        // Chegou na Final. A lógica de Ranking é feita na partida (registrarResultado).
        if(shouldSave) salvarDados();
        return;
    }
    
    const proximaPartida = eliminatoriasPartidas[partidaAtual.proximaPartidaId];
    const slot = partidaAtual.slotProximaPartida;

    if (proximaPartida && slot !== null) {
        proximaPartida.jogadores[slot] = vencedor;
        // Limpa o resultado da próxima partida
        proximaPartida.vencedorId = null;
        proximaPartida.resultado = [null, null];
        
        // Se a próxima partida tiver um BYE, resolve recursivamente
        const p1 = proximaPartida.jogadores[0];
        const p2 = proximaPartida.jogadores[1];
        if (p1?.nome.startsWith("BYE") || p2?.nome.startsWith("BYE")) {
            const vencedorBye = p1?.nome.startsWith("BYE") ? p2 : p1;
            proximaPartida.vencedorId = vencedorBye.id;
            proximaPartida.resultado = p1?.nome.startsWith("BYE") ? [0, 3] : [3, 0];
            
            avancarVencedor(proximaPartida.id, shouldSave);
        }
    }
    
    if(shouldSave) salvarDados();
}


// ==========================================================
// 5. LÓGICA DE RANKING FMTM (Pontuação ELO)
// ==========================================================

/**
 * Calcula a expectativa de vitória (chance de A vencer B) no sistema ELO.
 * @param {number} ratingA Rating atual do jogador A.
 * @param {number} ratingB Rating atual do jogador B.
 * @returns {number} Expectativa de vitória de A (valor entre 0 e 1).
 */
function calcularExpectativaVitoria(ratingA, ratingB) {
    // Fórmula ELO: Ea = 1 / (1 + 10^((RatingB - RatingA) / 400))
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / TAXA_CONVERSAO_ELO));
}

/**
 * Aplica a atualização de pontos ELO após uma partida.
 * @param {string} vencedorId ID do atleta vencedor.
 * @param {string} perdedorId ID do atleta perdedor.
 * @param {number} kFactor Fator K para a partida (usaremos o padrão 16).
 */
function atualizarRankingElo(vencedorId, perdedorId, kFactor = K_FACTOR) {
    const vencedor = rankingFMTM[vencedorId];
    const perdedor = rankingFMTM[perdedorId];

    if (!vencedor || !perdedor) return;

    const ratingVencedor = vencedor.pontuacao;
    const ratingPerdedor = perdedor.pontuacao;
    
    // 1. Calcula a expectativa de vitória (Esperado)
    const esperadoVencedor = calcularExpectativaVitoria(ratingVencedor, ratingPerdedor);
    // const esperadoPerdedor = calcularExpectativaVitoria(ratingPerdedor, ratingVencedor); // 1 - esperadoVencedor
    
    // 2. Resultado da partida (Real): 1 para vitória, 0 para derrota
    const resultadoVencedor = 1;
    const resultadoPerdedor = 0;

    // 3. Cálculo da Mudança de Pontos (Novo Rating = Antigo + K * (Resultado - Esperado))
    const mudancaVencedor = Math.round(kFactor * (resultadoVencedor - esperadoVencedor));
    const mudancaPerdedor = Math.round(kFactor * (resultadoPerdedor - (1 - esperadoVencedor)));
    
    // 4. Aplica as mudanças e registra o histórico
    vencedor.pontuacao += mudancaVencedor;
    perdedor.pontuacao += mudancaPerdedor;
    
    // Garante que o rating não caia abaixo do inicial (opcional: o ELO permite ratings negativos, mas para Tênis de Mesa é comum ter um piso)
    vencedor.pontuacao = Math.max(vencedor.pontuacao, PONTUACAO_INICIAL_FMTM);
    perdedor.pontuacao = Math.max(perdedor.pontuacao, PONTUACAO_INICIAL_FMTM);
    
    // Adiciona a pontuação temporária do torneio atual (pontosTorneioAtual) para o Ranking.js
    vencedor.pontosTorneioAtual = (vencedor.pontosTorneioAtual || 0) + mudancaVencedor;
    perdedor.pontosTorneioAtual = (perdedor.pontosTorneioAtual || 0) + mudancaPerdedor;

    // 5. Histórico (Crucial para a auditoria e JSON)
    vencedor.historico.push({
        oponenteId: perdedor.id,
        mudanca: mudancaVencedor,
        novoRating: vencedor.pontuacao,
        data: new Date().toISOString()
    });
    
    perdedor.historico.push({
        oponenteId: vencedor.id,
        mudanca: mudancaPerdedor,
        novoRating: perdedor.pontuacao,
        data: new Date().toISOString()
    });
    
    console.log(`ELO: ${vencedor.nome} ganhou ${mudancaVencedor} pts. ${perdedor.nome} perdeu ${mudancaPerdedor} pts.`);
    
    // Atualiza o rating no objeto atletasPorCategoria para manter a coerência
    for (const categoria in atletasPorCategoria) {
         atletasPorCategoria[categoria].forEach(atleta => {
             if (atleta.id === vencedorId || atleta.id === perdedorId) {
                 atleta.rating = rankingFMTM[atleta.id].pontuacao;
             }
         });
    }
}

/**
 * Função Placeholder para a antiga lógica de pontuação fixa por fase.
 * A pontuação real agora é feita pelo ELO em cada partida.
 */
function aplicarPontuacaoRanking(atletaId, faseEliminacao) {
    // Manter como um LOG/Placeholder para fases finais.
    console.log(`Atleta ${atletaId} chegou à fase: ${faseEliminacao}. Pontos ELO já aplicados partida a partida.`);
}







// Acessa o objeto jsPDF do escopo global
const { jsPDF } = window.jspdf;

/**
 * Função para gerar o PDF da Fase de Grupos (Súmulas Limpas para Anotação).
 * Esta função oculta a interface e captura apenas o conteúdo dos grupos.
 * @param {string} categoria - A categoria selecionada (Ex: 'Absoluto Masculino').
 */
function gerarPDFGruposLimpo(categoria) {
    // Elemento que contém o conteúdo que queremos capturar
    const input = document.getElementById('faseDeGrupos'); 
    const header = document.querySelector('header');
    const tabButtons = document.querySelector('.tab-buttons');
    const tabTitle = document.querySelector('#grupos h3');
    const tabInstruction = document.querySelector('#grupos p');
    
    if (!input || input.children.length === 0) {
        alert("Erro: Nenhum grupo gerado. Inicie o torneio primeiro.");
        return;
    }
    
    // Lista de elementos para esconder durante a captura do PDF
    const elementosAEsconder = [header, tabButtons, tabTitle, tabInstruction];
    
    // 1. Ocultar elementos da interface
    elementosAEsconder.forEach(el => {
        if (el) el.style.display = 'none';
    });
    
    // 2. Mudar temporariamente o fundo do body para branco para melhor impressão em PDF
    const originalBodyBackground = document.body.style.backgroundColor;
    document.body.style.backgroundColor = 'white';

    // 3. Gerar a imagem do conteúdo e criar o PDF
    // Usamos 'scale: 2' para uma imagem de melhor qualidade
    html2canvas(input, { scale: 2 }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4'); 
        
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // Adiciona a imagem ao PDF (ajusta automaticamente a altura)
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        
        // Salva o arquivo
        pdf.save(`Sumulas_Grupos_${categoria.replace(/\s/g, '_')}.pdf`);
        
        // 4. Restaurar a visualização dos elementos
        elementosAEsconder.forEach(el => {
            if (el) el.style.display = '';
        });
        document.body.style.backgroundColor = originalBodyBackground; // Restaura o fundo
    }).catch(error => {
        console.error("Erro ao gerar PDF da Fase de Grupos:", error);
        alert("Ocorreu um erro ao gerar o PDF. Verifique o console para detalhes.");

        // Garantir que a interface seja restaurada mesmo em caso de erro
        elementosAEsconder.forEach(el => {
            if (el) el.style.display = '';
        });
        document.body.style.backgroundColor = originalBodyBackground;
    });
}












/**
 * Função para gerar o PDF da Chave Eliminatória.
 * Só deve ser chamado quando a chave estiver totalmente gerada.
 * @param {string} categoria - A categoria selecionada.
 */
function gerarPDFEliminatorias(categoria) {
    const input = document.getElementById('chaveamentoContainer'); 
    const header = document.querySelector('header');
    const tabButtons = document.querySelector('.tab-buttons');
    const tabTitle = document.querySelector('#eliminatorias h3');

    // Verifica se a chave foi gerada (você pode precisar de uma verificação mais robusta aqui)
    if (!input || input.children.length === 0 || input.querySelector('p')) {
        alert("A Chave Eliminatória ainda não foi gerada. Complete a Fase de Grupos e calcule a classificação primeiro.");
        return;
    }

    // Lista de elementos para esconder durante a captura do PDF
    const elementosAEsconder = [header, tabButtons, tabTitle];
    
    elementosAEsconder.forEach(el => {
        if (el) el.style.display = 'none';
    });

    const originalBodyBackground = document.body.style.backgroundColor;
    document.body.style.backgroundColor = 'white';


    // 3. Gerar a imagem do conteúdo e criar o PDF
    html2canvas(input, { scale: 2 }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' = landscape (paisagem) para o chaveamento
        
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        
        pdf.save(`Chave_Eliminatoria_${categoria.replace(/\s/g, '_')}.pdf`);
        
        // 4. Restaurar a visualização dos elementos
        elementosAEsconder.forEach(el => {
            if (el) el.style.display = '';
        });
        document.body.style.backgroundColor = originalBodyBackground;
    }).catch(error => {
        console.error("Erro ao gerar PDF da Fase Eliminatória:", error);
        alert("Ocorreu um erro ao gerar o PDF. Verifique o console para detalhes.");
        
        elementosAEsconder.forEach(el => {
            if (el) el.style.display = '';
        });
        document.body.style.backgroundColor = originalBodyBackground;
    });
}