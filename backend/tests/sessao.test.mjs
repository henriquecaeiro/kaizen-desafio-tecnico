import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { prepararAmbiente } from '../test-support/ambiente.mjs';
const e = await prepararAmbiente();
const usuarios = await import('../src/services/usuarioService.js');
const sessoes = await import('../src/services/sessaoService.js');
after(e.fechar);
const cookie = token => `${e.config.jwt.nomeCookie}=${token}`;
const doCookie = r => r.headers.get('set-cookie').split(';')[0];

test('logout revoga o cookie antigo, e nao outra sessao da conta', async () => {
  const antiga = await e.login(); const outra = await e.login();
  assert.equal((await e.chamada('/auth/logout', { metodo: 'POST', cookie: antiga })).status, 200);
  assert.equal((await e.chamada('/auth/eu', { cookie: antiga })).status, 401);
  assert.equal((await e.chamada('/auth/eu', { cookie: outra })).status, 200);
  assert.equal((await e.chamada('/auth/logout', { metodo: 'POST', cookie: antiga })).status, 200);
  assert.equal((await e.chamada('/auth/logout', { metodo: 'POST' })).status, 200);
});
test('troca de senha revoga todas as sessoes anteriores e emite nova sessao', async () => {
  const antiga = await e.login(); const segunda = await e.login(); const b = await e.login(e.b);
  const r = await e.chamada('/perfil/senha', { metodo: 'PATCH', cookie: antiga,
    corpo: { senha_atual: 'TesteLocal123', nova_senha: 'NovaSenha123' } });
  assert.equal(r.status, 200);
  for (const c of [antiga, segunda]) assert.equal((await e.chamada('/auth/eu', { cookie: c })).status, 401);
  assert.equal((await e.chamada('/auth/eu', { cookie: doCookie(r) })).status, 200);
  assert.equal((await e.chamada('/auth/eu', { cookie: b })).status, 200);
  assert.equal((await e.chamada('/auth/login', { metodo: 'POST', corpo: { email: e.a.email, senha: 'TesteLocal123' } })).status, 401);
});
test('senha incorreta nao revoga a sessao', async () => {
  const c = await e.login(e.b);
  assert.equal((await e.chamada('/perfil/senha', { metodo: 'PATCH', cookie: c,
    corpo: { senha_atual: 'Incorreta123', nova_senha: 'OutraSenha123' } })).status, 422);
  assert.equal((await e.chamada('/auth/eu', { cookie: c })).status, 200);
});
test('JWT antigo sem jti, expirado, assinatura invalida e jti alheio sao rejeitados', async () => {
  const ativo = sessoes.criarSessao(e.b);
  const jti = jwt.decode(ativo).jti;
  const tokens = [
    jwt.sign({ sub: String(e.b.id) }, e.config.jwt.segredo, { expiresIn: '7d' }),
    jwt.sign({ sub: String(e.b.id), jti }, e.config.jwt.segredo, { expiresIn: -1 }),
    jwt.sign({ sub: String(e.b.id), jti }, 'segredo-ficticio-diferente', { expiresIn: '7d' }),
    jwt.sign({ sub: String(e.a.id), jti }, e.config.jwt.segredo, { expiresIn: '7d' }),
  ];
  for (const token of tokens) {
    const r = await e.chamada('/auth/eu', { cookie: cookie(token) });
    assert.equal(r.status, 401);
    assert.equal(r.headers.get('set-cookie'), null, 'Resposta de sessao antiga nao deve apagar cookie de login recente');
  }
});
test('expiracao persistida e exclusao de conta invalidam sessao', () => {
  const token = sessoes.criarSessao(e.b);
  e.db.prepare('UPDATE sessoes SET expira_em=0 WHERE id=?').run(jwt.decode(token).jti);
  assert.equal(sessoes.buscarSessao(token), null);
  const temporario = e.db.prepare(`INSERT INTO usuarios(nome,email,senha_hash,documento,criado_em,atualizado_em)
    VALUES('Temporario','temporario@example.test',?,'00000000000','hoje','hoje')`).run(e.b.senha_hash);
  const usuario = usuarios.buscarUsuarioPorId(Number(temporario.lastInsertRowid));
  const outro = sessoes.criarSessao(usuario);
  e.db.prepare('DELETE FROM usuarios WHERE id=?').run(usuario.id);
  assert.equal(sessoes.buscarSessao(outro), null);
  assert.equal(e.db.prepare('SELECT COUNT(*) n FROM sessoes WHERE usuario_id=?').get(usuario.id).n, 0);
});
test('login validado com hash antigo nao abre sessao depois de trocar senha', async () => {
  const antigo = await usuarios.autenticarUsuario(e.a.email, 'NovaSenha123');
  await usuarios.trocarSenha(e.a.id, 'NovaSenha123', 'SenhaFinal123');
  assert.throws(() => sessoes.criarSessao(antigo), erro => erro.status === 401);
});
test('trocas concorrentes de senha nao sobrescrevem credencial nova', async () => {
  const resultados = await Promise.allSettled([
    usuarios.trocarSenha(e.a.id, 'SenhaFinal123', 'ConcorrenteUm123'),
    usuarios.trocarSenha(e.a.id, 'SenhaFinal123', 'ConcorrenteDois123'),
  ]);
  assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(resultados.find(r => r.status === 'rejected').reason.codigo, 'SENHA_ALTERADA');
});
test('cadastro, login e troca preservam espacos e normalizacao Unicode existente', async () => {
  const original = '  Cafe\u0301Ａ123  ';
  const r = await e.chamada('/auth/cadastro', { metodo: 'POST', corpo: {
    nome: 'Pessoa Unicode', email: 'unicode@example.test', documento: '00000000000', senha: original,
  } });
  assert.equal(r.status, 201);
  const entrar = senha => e.chamada('/auth/login', { metodo: 'POST', corpo: { email: 'unicode@example.test', senha } });
  assert.equal((await entrar(original.trim())).status, 401);
  const login = await entrar('  CaféA123  ');
  assert.equal(login.status, 200);
  const troca = await e.chamada('/perfil/senha', { metodo: 'PATCH', cookie: doCookie(login),
    corpo: { senha_atual: original, nova_senha: '  PróximaＢ456  ' } });
  assert.equal(troca.status, 200);
  assert.equal((await entrar(original)).status, 401);
  assert.equal((await entrar('  PróximaB456  ')).status, 200);
  assert.equal((await entrar('PróximaB456')).status, 401);
});
