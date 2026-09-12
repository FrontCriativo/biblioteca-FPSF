import { api, escaparHtml, formatarData, ROTULOS_STATUS, montarSessaoNavbar } from './api.js';

const usuario = await montarSessaoNavbar();

if (!usuario) {
  location.href = 'login.html?destino=admin.html';
} else if (usuario.papel !== 'admin') {
  document.querySelector('[data-admin]').innerHTML = `
    <div class="empty-state">
      Esta área é restrita à coordenação da biblioteca.
      <a href="index.html">Voltar ao início</a>.
    </div>`;
} else {
  iniciar();
}

function aviso(texto, erro = false) {
  const caixa = document.querySelector('[data-aviso-global]');
  caixa.textContent = texto;
  caixa.className = `admin-aviso${erro ? ' admin-aviso--erro' : ''}`;
  caixa.style.display = 'block';
  clearTimeout(aviso.id);
  aviso.id = setTimeout(() => { caixa.style.display = 'none'; }, 4000);
}

async function comFeedback(acao, mensagemOk) {
  try {
    await acao();
    aviso(mensagemOk);
    return true;
  } catch (erro) {
    aviso(erro.message, true);
    return false;
  }
}

function iniciar() {
  document.querySelector('[data-admin]').hidden = false;

  document.querySelectorAll('.admin-tab').forEach((aba) => {
    aba.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((a) => a.classList.toggle('is-active', a === aba));
      document.querySelectorAll('[data-painel]').forEach((p) => {
        p.hidden = p.dataset.painel !== aba.dataset.aba;
      });
      if (aba.dataset.aba === 'usuarios') carregarUsuarios();
    });
  });

  document.querySelector('[data-filtro-status]').addEventListener('change', carregarReservas);
  montarFormularioLivro();
  recarregarTudo();
}

async function recarregarTudo() {
  await Promise.all([carregarResumo(), carregarReservas(), carregarLivros()]);
}

async function carregarResumo() {
  const resumo = await api.resumo();
  const cartoes = [
    ['Livros no acervo', resumo.livros],
    ['Exemplares', resumo.exemplares],
    ['Reservas aguardando', resumo.reservas_ativas],
    ['Com leitores', resumo.retiradas],
    ['Alunos cadastrados', resumo.usuarios],
  ];
  document.querySelector('[data-resumo]').innerHTML = cartoes.map(([rotulo, valor]) => `
    <div class="stat-card">
      <span class="stat-card__valor">${valor}</span>
      <span class="stat-card__rotulo">${rotulo}</span>
    </div>`).join('');
}

async function carregarReservas() {
  const status = document.querySelector('[data-filtro-status]').value;
  const reservas = await api.todasReservas(status);
  const corpo = document.querySelector('[data-tabela-reservas]');

  if (!reservas.length) {
    corpo.innerHTML = `<tr><td colspan="6" class="tabela-vazia">Nenhuma reserva neste filtro.</td></tr>`;
    return;
  }

  corpo.innerHTML = reservas.map((r) => `
    <tr>
      <td>
        <div class="cel-livro">
          <img src="assets/${escaparHtml(r.capa)}" alt="">
          <div>
            <strong>${escaparHtml(r.titulo)}</strong>
            <span>${escaparHtml(r.exemplar_codigo)}</span>
          </div>
        </div>
      </td>
      <td>
        <strong>${escaparHtml(r.usuario_nome)}</strong>
        <span class="cel-sub">${escaparHtml(r.turma ?? r.usuario_email)}</span>
      </td>
      <td>${formatarData(r.criada_em)}</td>
      <td>${r.status === 'ativa' ? formatarData(r.expira_em) : '—'}</td>
      <td><span class="selo selo--${r.status}">${ROTULOS_STATUS[r.status]}</span></td>
      <td class="cel-acoes">
        ${r.status === 'ativa' ? `<button class="mini-btn" data-retirar="${r.id}">Retirado</button>` : ''}
        ${r.status === 'retirada' ? `<button class="mini-btn" data-devolver="${r.id}">Devolvido</button>` : ''}
        ${['ativa', 'retirada'].includes(r.status)
          ? `<button class="mini-btn mini-btn--perigo" data-cancelar="${r.id}">Cancelar</button>` : ''}
      </td>
    </tr>`).join('');
}

document.addEventListener('click', async (evento) => {
  const alvo = evento.target.closest('[data-retirar], [data-devolver], [data-cancelar], [data-excluir], [data-add-exemplar]');
  if (!alvo) return;
  alvo.disabled = true;

  const { retirar, devolver, cancelar, excluir, addExemplar } = alvo.dataset;
  let ok = false;

  if (retirar) ok = await comFeedback(() => api.marcarRetirada(retirar), 'Retirada registrada.');
  if (devolver) ok = await comFeedback(() => api.marcarDevolvida(devolver), 'Devolução registrada.');
  if (cancelar) ok = await comFeedback(() => api.cancelarReserva(cancelar), 'Reserva cancelada.');
  if (addExemplar) ok = await comFeedback(() => api.adicionarExemplares(addExemplar, 1), 'Exemplar adicionado.');
  if (excluir) {
    if (!confirm('Remover este livro do acervo? A ação não pode ser desfeita.')) {
      alvo.disabled = false;
      return;
    }
    ok = await comFeedback(() => api.removerLivro(excluir), 'Livro removido.');
  }

  alvo.disabled = false;
  if (ok) recarregarTudo();
});

async function carregarLivros() {
  const livros = await api.livros();
  document.querySelector('[data-tabela-livros]').innerHTML = livros.map((l) => `
    <tr>
      <td>
        <div class="cel-livro">
          <img src="assets/${escaparHtml(l.capa)}" alt="">
          <div>
            <strong>${escaparHtml(l.titulo)}</strong>
            <span>${escaparHtml(l.autor)}</span>
          </div>
        </div>
      </td>
      <td>${escaparHtml(l.materia_nome)}</td>
      <td>${l.total_exemplares}</td>
      <td>
        <span class="selo ${l.disponiveis ? 'selo--ativa' : 'selo--cancelada'}">
          ${l.disponiveis} ${l.disponiveis === 1 ? 'livre' : 'livres'}
        </span>
      </td>
      <td class="cel-acoes">
        <button class="mini-btn" data-add-exemplar="${l.id}">+ exemplar</button>
        <button class="mini-btn mini-btn--perigo" data-excluir="${l.id}">Remover</button>
      </td>
    </tr>`).join('');
}

async function montarFormularioLivro() {
  const materias = await api.materias();
  const select = document.querySelector('#novo-materia');
  select.innerHTML = materias
    .map((m) => `<option value="${escaparHtml(m.slug)}">${escaparHtml(m.nome)}</option>`)
    .join('');

  document.querySelector('[data-form-livro]').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const form = evento.target;
    const dados = Object.fromEntries(new FormData(form));
    const enviado = await comFeedback(() => api.criarLivro(dados), 'Livro adicionado ao acervo.');
    if (enviado) {
      form.reset();
      recarregarTudo();
    }
  });
}

async function carregarUsuarios() {
  const usuarios = await api.usuarios();
  document.querySelector('[data-tabela-usuarios]').innerHTML = usuarios.map((u) => `
    <tr>
      <td><strong>${escaparHtml(u.nome)}</strong></td>
      <td>${escaparHtml(u.email)}</td>
      <td>${escaparHtml(u.turma ?? '—')}</td>
      <td><span class="selo selo--${u.papel === 'admin' ? 'retirada' : 'ativa'}">${u.papel}</span></td>
      <td>${u.reservas_ativas}</td>
    </tr>`).join('');

  const form = document.querySelector('[data-form-usuario]');
  if (form.dataset.pronto) return;
  form.dataset.pronto = '1';
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(evento.target));
    const enviado = await comFeedback(() => api.criarUsuario(dados), 'Usuário cadastrado.');
    if (enviado) {
      evento.target.reset();
      carregarUsuarios();
      carregarResumo();
    }
  });
}
