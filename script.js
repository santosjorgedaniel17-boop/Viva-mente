
);
// ==============================
// CONFIGURAÇÃO DO SUPABASE
// ==============================

const SUPABASE_URL = "https://hfvjtwhfzvnqdkhhmbyh.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_iiz4_ldEhGT7EwwjE76gcA_Qy0NRmvu";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


const $ = (id) => document.getElementById(id);

// Protege contra HTML injetado em textos digitados por outras pessoas
const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

const fmtHora = (t) => (t ? String(t).slice(0, 5) : '');

const fmtData = (d) => (d ? String(d).split('-').reverse().join('/') : '');

const novoUuid = () =>
    (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });

const nomeSeguro = (n) =>
    String(n).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');

const vazio = (msg, extra = '') => `
    <p class="col-span-full text-center py-6 text-slate-300 text-[10px] font-black uppercase ${extra}">
        ${msg}
    </p>`;

// Usado quando não há paciente selecionado
const EMPTY = {
    id: null, nome: '', telefone: '-', prescricoes: [], checklist: [],
    exames: [], equipe: [], cognicao: [], mood: null, acompanhamento: null
};

const app = {

    state: {
        userType: null,
        perfil: null,
        activePacienteId: null,
        pacientes: [],
        incidentes: [],       // só médico
        chart: null,
        editandoMedicamentoId: null,
        editandoTarefaId: null
    },

    // ---------------------------------------------
    // INÍCIO / SESSÃO
    // ---------------------------------------------
    async init() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();

            if (!session) {
                window.location.href = 'login.html';
                return;
            }

            const { data: perfil, error } = await supabaseClient
                .from('profiles').select('*').eq('id', session.user.id).single();

            if (error || !perfil) {
                await supabaseClient.auth.signOut();
                window.location.href = 'login.html';
                return;
            }

            this.state.perfil = perfil;
            this.state.userType = perfil.role;   // vem do BANCO, não do navegador

            this.renderBadge();

            await this.carregarPacientes();

            if (perfil.role === 'medico') {
                await this.carregarIncidentes();
                this.assinarIncidentes();
            }

            this.refreshUI();

        } catch (err) {
            console.error(err);
            this.showToast(this.msgErro(err));
        }
    },

    async logout() {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    },

    renderBadge() {
        const b = $('badge-perfil');
        if (!b) return;
        const medico = this.state.userType === 'medico';

        b.textContent = `${medico ? 'Médico' : 'Cuidador'} • ${this.state.perfil.nome}`;
        b.className =
            'ml-4 px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full ' +
            (medico ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600');
    },

    // ---------------------------------------------
    // UTILITÁRIOS
    // ---------------------------------------------
    msgErro(err) {
        return (err && err.message) ? err.message : 'Algo deu errado. Tente novamente.';
    },

    // Executa uma ação, mostra aviso de sucesso ou o erro
    async tentar(fn, msgOk) {
        try {
            await fn();
            if (msgOk) this.showToast(msgOk);
        } catch (err) {
            console.error(err);
            this.showToast(this.msgErro(err));
        }
    },

    hoje() {
        const d = new Date();
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    },

    calcIdade(nasc) {
        if (!nasc) return '';
        const n = new Date(nasc + 'T00:00:00');
        const h = new Date();
        let idade = h.getFullYear() - n.getFullYear();
        const m = h.getMonth() - n.getMonth();
        if (m < 0 || (m === 0 && h.getDate() < n.getDate())) idade--;
        return idade;
    },

    fmtMood(ts) {
        const d = new Date(ts);
        const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return d.toDateString() === new Date().toDateString()
            ? hm
            : `${d.toLocaleDateString('pt-BR')} ${hm}`;
    },

    getActive() {
        return this.state.pacientes.find(p => p.id === this.state.activePacienteId) || null;
    },

    exigirPaciente() {
        const p = this.getActive();
        if (!p) this.showToast('Selecione um paciente primeiro.');
        return p;
    },

    medHora(pr) {
        return [pr.intervalo, pr.horario ? fmtHora(pr.horario) : '']
            .filter(Boolean).join(' • ') || 'Sem horário';
    },

    // Horário mostrado numa tarefa (se veio de prescrição sem horário, mostra o intervalo)
    tarefaHora(t, p) {
        if (t.hora) return fmtHora(t.hora);
        if (t.prescricao_id) {
            const pr = p.prescricoes.find(x => x.id === t.prescricao_id);
            if (pr && pr.intervalo) return pr.intervalo;
        }
        return 'Sem horário';
    },

    // ---------------------------------------------
    // CARREGAR DADOS DO BANCO
    // ---------------------------------------------
    async carregarPacientes() {
        const { data, error } = await supabaseClient
            .from('pacientes').select('*').order('nome');
        if (error) throw error;

        this.state.pacientes = data.map(x => ({
            ...x,
            idade: this.calcIdade(x.data_nascimento),
            prescricoes: [], checklist: [], equipe: [], exames: [],
            cognicao: [], mood: null, acompanhamento: null
        }));

        if (!this.state.pacientes.some(p => p.id === this.state.activePacienteId)) {
            this.state.activePacienteId =
                this.state.pacientes.length ? this.state.pacientes[0].id : null;
        }

        this.renderSelectors();

        if (this.state.activePacienteId) {
            await this.carregarDetalhes(this.state.activePacienteId);
        }
    },

    async carregarDetalhes(id) {
        const p = this.state.pacientes.find(x => x.id === id);
        if (!p) return;

        const t = (tabela) => supabaseClient.from(tabela).select('*').eq('paciente_id', id);

        const [pr, tf, ex, eq, cg, hm, ac] = await Promise.all([
            t('prescricoes').order('created_at'),
            t('tarefas').order('created_at'),
            t('exames').order('data_exame', { ascending: false }).order('created_at', { ascending: false }),
            t('equipe').order('created_at'),
            t('avaliacoes_cognitivas').order('data_avaliacao').order('created_at'),
            t('humor_registros').order('created_at', { ascending: false }).limit(1),
            t('acompanhamentos').order('created_at', { ascending: false }).limit(1)
        ]);

        for (const r of [pr, tf, ex, eq, cg, hm, ac]) {
            if (r.error) throw r.error;
        }

        p.prescricoes = pr.data;
        p.checklist = tf.data;
        p.exames = ex.data;
        p.equipe = eq.data;
        p.cognicao = cg.data.map(x => x.pontuacao);

        p.mood = hm.data.length
            ? {
                type: hm.data[0].tipo,
                icon: hm.data[0].icone,
                label: hm.data[0].rotulo,
                time: this.fmtMood(hm.data[0].created_at)
            }
            : null;

        p.acompanhamento = ac.data.length ? ac.data[0].data_acompanhamento : null;
    },

    async carregarIncidentes() {
        const { data, error } = await supabaseClient
            .from('incidentes')
            .select('*, pacientes(nome)')
            .order('created_at', { ascending: false })
            .limit(100);
        if (error) throw error;
        this.state.incidentes = data;
    },

    // Recarrega o paciente aberto e redesenha a tela
    async recarregar() {
        if (this.state.activePacienteId) {
            await this.carregarDetalhes(this.state.activePacienteId);
        }
        this.refreshUI();
    },

    // Médico recebe aviso na hora quando um cuidador relata incidente
    assinarIncidentes() {
        try {
            supabaseClient
                .channel('incidentes-novos')
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'incidentes' },
                    async () => {
                        await this.carregarIncidentes();
                        this.renderMedicoUI();
                        this.showToast('Novo incidente relatado!');
                    }
                )
                .subscribe();
        } catch (e) {
            console.warn('Tempo real indisponível:', e);
        }
    },

    // ---------------------------------------------
    // TELAS
    // ---------------------------------------------
    refreshUI() {
        const medico = this.state.userType === 'medico';

        $('area-medico').classList.toggle('hidden-el', !medico);
        $('area-cuidador').classList.toggle('hidden-el', medico);

        if (medico) this.renderMedicoUI();
        else this.renderCuidadorUI();
    },

    async switchPaciente(id) {
        this.state.activePacienteId = id;
        await this.tentar(() => this.carregarDetalhes(id));
        this.refreshUI();
    },

    irParaPaciente(id) {
        const s = $('select-global-paciente');
        if (s) s.value = id;
        this.switchPaciente(id);
        this.switchTab('prescricoes');
    },

    renderSelectors() {
        const s = $('select-global-paciente');
        if (!s) return;

        if (!this.state.pacientes.length) {
            s.innerHTML = '<option value="">Nenhum paciente</option>';
            s.disabled = true;
            return;
        }

        s.disabled = false;
        s.innerHTML = this.state.pacientes
            .map(p => `<option value="${p.id}">${esc(p.nome)}</option>`)
            .join('');
        s.value = this.state.activePacienteId;
    },

    switchTab(tab) {
        document.querySelectorAll('.tab-view')
            .forEach(v => v.classList.add('hidden-el'));

        document.querySelectorAll('button[id^="tab-"]')
            .forEach(t => t.classList.remove('tab-active'));

        $(`view-${tab}`).classList.remove('hidden-el');
        $(`tab-${tab}`).classList.add('tab-active');
    },

    // ---------------------------------------------
    // PAINEL DO MÉDICO
    // ---------------------------------------------
    renderMedicoUI() {
        const p = this.getActive();
        const v = p || EMPTY;

        if (!p) {
            $('medico-stats').innerHTML = `
                <div class="md:col-span-2 lg:col-span-4 bg-white p-8 rounded-[2rem] card-shadow text-center text-sm font-bold text-slate-400">
                    Nenhum paciente cadastrado ainda. Clique em "Novo Paciente" para começar.
                </div>`;
        } else {
            const naoLidos = this.state.incidentes
                .filter(i => i.paciente_id === p.id && !i.lido_pelo_medico).length;

            const moodHtml = p.mood
                ? `
                    <div class="flex items-center space-x-2 mt-2 bg-indigo-50 p-2 rounded-xl">
                        <span class="text-xl">${esc(p.mood.icon)}</span>
                        <span class="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">
                            ${esc(p.mood.label)} às ${esc(p.mood.time)}
                        </span>
                    </div>`
                : `
                    <p class="text-[9px] font-bold text-slate-300 mt-2 italic uppercase">
                        Sem reporte de humor
                    </p>`;

            $('medico-stats').innerHTML = `
                <div class="bg-white p-6 rounded-[2rem] border-l-4 border-indigo-500 card-shadow">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Humor Recente</p>
                    ${moodHtml}
                </div>

                <div class="bg-white p-6 rounded-[2rem] border-l-4 border-indigo-500 card-shadow">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contato Emergência</p>
                    <h4 class="text-sm font-black text-indigo-600 mt-1">${esc(p.telefone)}</h4>
                    <button
                        onclick="app.openModal('modal-vincular')"
                        class="mt-3 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600"
                    >
                        <i class="fas fa-link mr-1"></i> Vincular cuidador
                    </button>
                </div>

                <div class="bg-white p-6 rounded-[2rem] border-l-4 ${naoLidos ? 'border-amber-500' : 'border-emerald-500'} card-shadow">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status Geral</p>
                    <h4 class="text-sm font-black ${naoLidos ? 'text-amber-600' : 'text-emerald-600'} mt-1">
                        ${naoLidos ? `Atenção (${naoLidos} incidente${naoLidos > 1 ? 's' : ''})` : 'Estável'}
                    </h4>
                    <p class="text-[9px] font-bold text-slate-400 mt-1 uppercase">
                        ${esc(p.diagnostico)} • ${esc(p.estagio)}
                    </p>
                </div>

                <div class="bg-white p-6 rounded-[2rem] border-l-4 border-violet-500 card-shadow">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Acompanhamento</p>
                    <h4 class="text-sm font-black text-violet-600 mt-1">
                        ${p.acompanhamento ? fmtData(p.acompanhamento) : 'Sem data marcada'}
                    </h4>
                </div>
            `;
        }

        this.renderPrescricoes(v);
        this.renderExames(v);
        this.renderRotinaMedico(v);
        this.renderEquipeMedico(v);
        this.renderIncidentes();
        this.initChart(v);
    },

    renderIncidentes() {
        const lista = $('medico-incidentes-lista');
        const badge = $('badge-incidentes');

        const naoLidos = this.state.incidentes.filter(i => !i.lido_pelo_medico).length;

        if (badge) {
            badge.textContent = naoLidos;
            badge.classList.toggle('hidden-el', naoLidos === 0);
        }

        if (!lista) return;

        lista.innerHTML = this.state.incidentes.map(i => `
            <div class="p-5 rounded-2xl border ${i.lido_pelo_medico ? 'bg-slate-50 border-slate-100 opacity-70' : 'bg-red-50 border-red-100'}">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                        <p class="text-sm font-black text-slate-800">${esc(i.pacientes ? i.pacientes.nome : 'Paciente')}</p>
                        <span class="text-[9px] font-black uppercase tracking-widest text-red-500">
                            ${esc(i.tipo)}
                        </span>
                    </div>
                    <span class="text-[9px] font-black text-slate-400">
                        ${new Date(i.created_at).toLocaleString('pt-BR')}
                    </span>
                </div>

                <p class="text-xs font-medium text-slate-600 mb-3">${esc(i.descricao || 'Sem descrição.')}</p>

                <div class="flex gap-4">
                    <button
                        onclick="app.irParaPaciente('${i.paciente_id}')"
                        class="text-[10px] font-black uppercase tracking-widest text-indigo-600"
                    >Ver paciente</button>

                    ${i.lido_pelo_medico
                        ? '<span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Lido</span>'
                        : `<button
                                onclick="app.marcarLido('${i.id}')"
                                class="text-[10px] font-black uppercase tracking-widest text-emerald-600"
                           >Marcar como lido</button>`}
                </div>
            </div>
        `).join('') || vazio('Nenhum incidente relatado');
    },

    async marcarLido(id) {
        await this.tentar(async () => {
            const { error } = await supabaseClient
                .from('incidentes').update({ lido_pelo_medico: true }).eq('id', id);
            if (error) throw error;

            const inc = this.state.incidentes.find(i => i.id === id);
            if (inc) inc.lido_pelo_medico = true;

            this.renderMedicoUI();
        });
    },

    renderPrescricoes(p) {
        $('medico-prescricoes-body').innerHTML = p.prescricoes.map(pr => `
            <tr>
                <td class="py-4 font-bold text-sm text-slate-700">${esc(pr.medicamento)}</td>
                <td class="py-4 text-xs font-medium text-slate-500">${esc(pr.dose)}</td>
                <td class="py-4 text-xs font-black text-slate-400">${esc(this.medHora(pr))}</td>
                <td class="py-4 text-right whitespace-nowrap">
                    <button
                        onclick="app.editarMedicamento('${pr.id}')"
                        class="text-slate-300 hover:text-indigo-500 mr-3"
                        title="Alterar horário"
                    ><i class="fas fa-edit"></i></button>

                    <button
                        onclick="app.removePres('${pr.id}')"
                        class="text-slate-300 hover:text-red-500"
                        title="Remover"
                    ><i class="fas fa-minus-circle"></i></button>
                </td>
            </tr>
        `).join('') || `
            <tr>
                <td colspan="4" class="py-10 text-center text-xs text-slate-400 italic">
                    Sem prescrições
                </td>
            </tr>`;
    },

    renderExames(p) {
        $('medico-exames-lista').innerHTML = p.exames.map(ex => `
            <div class="bg-slate-50 p-5 rounded-3xl border border-slate-200">
                <div class="flex justify-between mb-3">
                    <i class="fas fa-file-medical text-indigo-500"></i>
                    <span class="text-[9px] font-black text-slate-300">${fmtData(ex.data_exame)}</span>
                </div>

                <h5 class="font-black text-slate-800 text-xs">${esc(ex.nome)}</h5>

                ${ex.resultado ? `<p class="text-xs text-slate-500 mt-2 whitespace-pre-line">${esc(ex.resultado)}</p>` : ''}

                <div class="flex gap-4 mt-3">
                    ${ex.arquivo_path ? `
                        <button
                            onclick="app.abrirExame('${ex.id}')"
                            class="text-[10px] font-black uppercase tracking-widest text-indigo-600"
                        ><i class="fas fa-paperclip mr-1"></i>Abrir arquivo</button>` : ''}

                    <button
                        onclick="app.removeExame('${ex.id}')"
                        class="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-red-500"
                    >Remover</button>
                </div>
            </div>
        `).join('') || vazio('Aguardando exames...', 'py-10');
    },

    renderRotinaMedico(p) {
        $('medico-rotina-lista').innerHTML = p.checklist.map(t => `
            <div class="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl">
                <div>
                    <p class="text-sm font-bold text-slate-700">${esc(t.tarefa)}</p>
                    ${t.descricao ? `<p class="text-xs text-slate-400">${esc(t.descricao)}</p>` : ''}
                    <span class="text-[9px] font-black text-indigo-400 uppercase">${esc(this.tarefaHora(t, p))}</span>
                </div>

                <div class="whitespace-nowrap">
                    <button
                        onclick="app.editarTarefa('${t.id}')"
                        class="text-slate-300 hover:text-indigo-500 mr-3"
                        title="Alterar horário"
                    ><i class="fas fa-edit"></i></button>

                    <button
                        onclick="app.removeTask('${t.id}')"
                        class="text-slate-200 hover:text-red-500"
                        title="Remover"
                    ><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('') || vazio('Nenhuma atividade programada');
    },

    renderEquipeMedico(p) {
        $('medico-equipe-lista').innerHTML = p.equipe.map(m => `
            <div class="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <i class="fas fa-user-md"></i>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-slate-700">${esc(m.nome)}</p>
                        <span class="text-[9px] font-black text-slate-400 uppercase">${esc(m.cargo)}</span>
                    </div>
                </div>

                <button
                    onclick="app.removeMember('${m.id}')"
                    class="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100"
                ><i class="fas fa-times"></i></button>
            </div>
        `).join('') || vazio('Sem equipe vinculada', 'italic');
    },

    // ---------------------------------------------
    // PAINEL DO CUIDADOR
    // ---------------------------------------------
    renderCuidadorUI() {
        const p = this.getActive();
        const v = p || EMPTY;
        const hoje = this.hoje();

        $('cuidador-paciente-nome').innerText =
            p ? p.nome : 'Nenhum paciente vinculado';

        $('cuidador-paciente-info').innerText =
            p
                ? `${p.idade} anos • Gravidade ${p.estagio}`
                : 'Peça ao médico para vincular o seu e-mail a um paciente.';

        const campoData = $('data-acompanhamento');
        if (campoData) campoData.value = v.acompanhamento || '';

        // Medicações
        const listaMed = $('cuidador-medicacoes-lista');
        if (listaMed) {
            listaMed.innerHTML = v.prescricoes.map(med => `
                <div class="flex items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-xl">
                            <i class="fas fa-pills"></i>
                        </div>
                        <div>
                            <p class="text-sm font-black text-slate-700">${esc(med.medicamento)}</p>
                            <p class="text-xs text-slate-400 font-medium">${esc(med.dose)}</p>
                        </div>
                    </div>

                    <div class="flex items-center gap-3">
                        <span class="text-xs font-black text-indigo-500">${esc(this.medHora(med))}</span>

                        <button
                            onclick="app.editarMedicamento('${med.id}')"
                            class="w-9 h-9 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-indigo-500 hover:bg-indigo-50"
                            title="Alterar horário"
                        ><i class="fas fa-edit"></i></button>
                    </div>
                </div>
            `).join('') || vazio('Sem medicações');
        }

        // Humor
        document.querySelectorAll('.emoji-btn')
            .forEach(btn => btn.classList.remove('active'));

        const statusDiv = $('mood-status');

        if (v.mood) {
            statusDiv.classList.remove('hidden-el');
            $('mood-label').innerText =
                `${v.mood.icon} ${v.mood.label} (${v.mood.time})`;

            const btn = $(`mood-${v.mood.type}`);
            if (btn) btn.classList.add('active');
        } else {
            statusDiv.classList.add('hidden-el');
        }

        // Checklist
        $('cuidador-checklist').innerHTML = [...v.checklist]
            .sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'))
            .map(i => {
                const feita = i.concluida_em === hoje;

                return `
                <div class="flex items-center justify-between p-5 rounded-[2rem] border-2 transition-all ${
                    feita ? 'bg-slate-50 border-slate-50 opacity-60' : 'bg-white border-indigo-50 shadow-sm'
                }">
                    <div class="flex items-center space-x-4">
                        <button
                            onclick="app.toggleCheck('${i.id}')"
                            class="w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all ${
                                feita
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'border-indigo-100 text-indigo-100 hover:border-indigo-500'
                            }"
                        ><i class="fas fa-check"></i></button>

                        <div>
                            <p class="font-bold text-sm ${feita ? 'text-slate-400 line-through' : 'text-slate-700'}">
                                ${esc(i.tarefa)}
                            </p>
                            ${i.descricao ? `<p class="text-xs text-slate-400">${esc(i.descricao)}</p>` : ''}
                            <span class="text-[9px] font-black text-indigo-400 tracking-widest uppercase">
                                ${esc(this.tarefaHora(i, v))}
                            </span>
                        </div>
                    </div>

                    <button
                        onclick="app.editarTarefa('${i.id}')"
                        class="text-slate-300 hover:text-indigo-500"
                        title="Alterar horário"
                    ><i class="fas fa-edit"></i></button>
                </div>`;
            }).join('') || vazio('Nenhuma tarefa para hoje');

        // Exames
        $('cuidador-exames-lista').innerHTML = v.exames.map(ex => `
            <div class="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <i class="fas fa-file-alt text-slate-400"></i>

                <div class="flex-1 overflow-hidden">
                    <p class="text-[10px] font-black text-slate-800 truncate">${esc(ex.nome)}</p>
                    <p class="text-[9px] font-bold text-slate-400">${fmtData(ex.data_exame)}</p>
                </div>

                ${ex.arquivo_path ? `
                    <button
                        onclick="app.abrirExame('${ex.id}')"
                        class="text-indigo-400 hover:text-indigo-600"
                        title="Abrir arquivo"
                    ><i class="fas fa-paperclip"></i></button>` : ''}

                ${ex.enviado_por === this.state.perfil.id ? `
                    <button
                        onclick="app.removeExame('${ex.id}')"
                        class="text-slate-300 hover:text-red-500"
                        title="Remover"
                    ><i class="fas fa-times"></i></button>` : ''}
            </div>
        `).join('');

        // Equipe
        $('cuidador-equipe-lista').innerHTML = v.equipe.map(m => `
            <div class="flex items-center space-x-3 p-4 bg-slate-50 rounded-2xl">
                <div class="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-500 shadow-sm">
                    <i class="fas fa-stethoscope text-[10px]"></i>
                </div>
                <div>
                    <p class="text-[10px] font-black text-slate-700">${esc(m.nome)}</p>
                    <p class="text-[8px] font-bold text-slate-400 uppercase">${esc(m.cargo)}</p>
                </div>
            </div>
        `).join('');

        const done = v.checklist.filter(i => i.concluida_em === hoje).length;
        $('progresso-diario').innerText =
            `${done}/${v.checklist.length} concluídos hoje`;
    },

    // ---------------------------------------------
    // AÇÕES DO CUIDADOR
    // ---------------------------------------------
    async selectMood(type, icon, label) {
        const p = this.exigirPaciente();
        if (!p) return;

        await this.tentar(async () => {
            const { error } = await supabaseClient.from('humor_registros').insert({
                paciente_id: p.id,
                tipo: type,
                icone: icon,
                rotulo: label,
                registrado_por: this.state.perfil.id
            });
            if (error) throw error;

            await this.recarregar();
        }, `Humor "${label}" registrado!`);
    },

    async toggleCheck(id) {
        const p = this.getActive();
        if (!p) return;

        const t = p.checklist.find(x => x.id === id);
        if (!t) return;

        const hoje = this.hoje();
        const novo = t.concluida_em === hoje ? null : hoje;

        await this.tentar(async () => {
            const { error } = await supabaseClient
                .from('tarefas').update({ concluida_em: novo }).eq('id', id);
            if (error) throw error;

            t.concluida_em = novo;
            this.renderCuidadorUI();
        });
    },

    async selecionarData(data) {
        const p = this.exigirPaciente();
        if (!p || !data) return;

        await this.tentar(async () => {
            const { error } = await supabaseClient.from('acompanhamentos').insert({
                paciente_id: p.id,
                data_acompanhamento: data,
                criado_por: this.state.perfil.id
            });
            if (error) throw error;

            p.acompanhamento = data;
            this.refreshUI();
        }, `Acompanhamento do dia ${fmtData(data)} selecionado!`);
    },

    async sendIntercorrencia(e) {
        e.preventDefault();

        const p = this.exigirPaciente();
        if (!p) return;

        const tipo = $('inc-tipo').value;
        const desc = $('inc-desc').value.trim();

        await this.tentar(async () => {
            const { error } = await supabaseClient.from('incidentes').insert({
                paciente_id: p.id,
                tipo,
                descricao: desc || null,
                registrado_por: this.state.perfil.id
            });
            if (error) throw error;

            $('inc-desc').value = '';
            this.closeModal();
        }, `Incidente (${tipo}) enviado ao médico!`);
    },

    async addExame(e) {
        e.preventDefault();

        const form = e.target;
        const p = this.exigirPaciente();
        if (!p) return;

        const nome = $('exame-nome').value.trim();
        const data = $('exame-data').value;
        const resultado = $('exame-resultados').value.trim();
        const arquivo = $('exame-arquivo').files[0];

        await this.tentar(async () => {
            let caminho = null;

            if (arquivo) {
                caminho = `${p.id}/${Date.now()}_${nomeSeguro(arquivo.name)}`;

                const { error: up } = await supabaseClient
                    .storage.from('exames').upload(caminho, arquivo);
                if (up) throw up;
            }

            const { error } = await supabaseClient.from('exames').insert({
                paciente_id: p.id,
                nome,
                data_exame: data,
                resultado: resultado || null,
                arquivo_path: caminho,
                enviado_por: this.state.perfil.id
            });

            if (error) {
                if (caminho) {
                    await supabaseClient.storage.from('exames').remove([caminho]);
                }
                throw error;
            }

            form.reset();
            await this.recarregar();
        }, 'Exame salvo!');
    },

    async abrirExame(id) {
        const p = this.getActive();
        const ex = p && p.exames.find(x => x.id === id);
        if (!ex || !ex.arquivo_path) return;

        // abre a aba antes do await para o navegador não bloquear
        const aba = window.open('', '_blank');

        try {
            const { data, error } = await supabaseClient
                .storage.from('exames').createSignedUrl(ex.arquivo_path, 3600);
            if (error) throw error;

            if (aba) aba.location.href = data.signedUrl;
            else window.location.href = data.signedUrl;
        } catch (err) {
            if (aba) aba.close();
            this.showToast(this.msgErro(err));
        }
    },

    async removeExame(id) {
        const p = this.getActive();
        const ex = p && p.exames.find(x => x.id === id);
        if (!ex) return;

        await this.tentar(async () => {
            const { error } = await supabaseClient.from('exames').delete().eq('id', id);
            if (error) throw error;

            if (ex.arquivo_path) {
                await supabaseClient.storage.from('exames').remove([ex.arquivo_path]);
            }

            await this.recarregar();
        }, 'Exame removido.');
    },

    // ---------------------------------------------
    // AÇÕES DO MÉDICO
    // ---------------------------------------------
    async addPaciente(e) {
        e.preventDefault();

        const form = e.target;
        const fd = new FormData(form);

        await this.tentar(async () => {
            const id = novoUuid();

            const { error } = await supabaseClient.from('pacientes').insert({
                id,
                medico_id: this.state.perfil.id,
                nome: fd.get('nome').trim(),
                data_nascimento: fd.get('dataNascimento'),
                estagio: fd.get('estagio'),
                diagnostico: fd.get('diagnostico').trim(),
                data_diagnostico: fd.get('dataDiagnostico'),
                telefone: fd.get('telefone').trim()
            });
            if (error) throw error;

            let aviso = 'Paciente cadastrado!';
            const email = (fd.get('emailCuidador') || '').trim();

            if (email) {
                const { error: e2 } = await supabaseClient.rpc('vincular_cuidador', {
                    p_paciente: id,
                    p_email: email
                });
                if (e2) aviso = `Paciente cadastrado, mas o cuidador não foi vinculado: ${e2.message}`;
            }

            this.state.activePacienteId = id;
            form.reset();
            this.closeModal();

            await this.carregarPacientes();
            this.refreshUI();

            this.showToast(aviso);
        });
    },

    async vincularCuidador(e) {
        e.preventDefault();

        const p = this.exigirPaciente();
        if (!p) return;

        const campo = $('vincular-email');

        await this.tentar(async () => {
            const { error } = await supabaseClient.rpc('vincular_cuidador', {
                p_paciente: p.id,
                p_email: campo.value.trim()
            });
            if (error) throw error;

            campo.value = '';
            this.closeModal();
        }, 'Cuidador vinculado ao paciente!');
    },

    async addPrescricao(e) {
        e.preventDefault();

        const form = e.target;
        const p = this.exigirPaciente();
        if (!p) return;

        const fd = new FormData(form);
        const med = fd.get('med').trim();

        await this.tentar(async () => {
            const idPr = novoUuid();

            const { error } = await supabaseClient.from('prescricoes').insert({
                id: idPr,
                paciente_id: p.id,
                medicamento: med,
                dose: fd.get('dose').trim(),
                intervalo: fd.get('hora')
            });
            if (error) throw error;

            // a medicação também vira tarefa no checklist do cuidador
            const { error: e2 } = await supabaseClient.from('tarefas').insert({
                paciente_id: p.id,
                prescricao_id: idPr,
                tarefa: `Medicamento: ${med}`
            });
            if (e2) throw e2;

            form.reset();
            this.closeModal();
            await this.recarregar();
        }, 'Medicação prescrita!');
    },

    async removePres(id) {
        await this.tentar(async () => {
            // as tarefas ligadas à prescrição são apagadas junto (on delete cascade)
            const { error } = await supabaseClient.from('prescricoes').delete().eq('id', id);
            if (error) throw error;

            await this.recarregar();
        }, 'Prescrição removida.');
    },

    async addTask(e) {
        e.preventDefault();

        const form = e.target;
        const p = this.exigirPaciente();
        if (!p) return;

        await this.tentar(async () => {
            const { error } = await supabaseClient.from('tarefas').insert({
                paciente_id: p.id,
                tarefa: $('task-name').value.trim(),
                descricao: $('task-message').value.trim() || null,
                hora: $('task-time').value || null
            });
            if (error) throw error;

            form.reset();
            await this.recarregar();
        }, 'Atividade agendada!');
    },

    async removeTask(id) {
        await this.tentar(async () => {
            const { error } = await supabaseClient.from('tarefas').delete().eq('id', id);
            if (error) throw error;

            await this.recarregar();
        }, 'Atividade removida.');
    },

    async addMember(e) {
        e.preventDefault();

        const form = e.target;
        const p = this.exigirPaciente();
        if (!p) return;

        const fd = new FormData(form);

        await this.tentar(async () => {
            const { error } = await supabaseClient.from('equipe').insert({
                paciente_id: p.id,
                nome: fd.get('nome').trim(),
                cargo: fd.get('cargo').trim()
            });
            if (error) throw error;

            form.reset();
            this.closeModal();
            await this.recarregar();
        }, 'Membro adicionado!');
    },

    async removeMember(id) {
        await this.tentar(async () => {
            const { error } = await supabaseClient.from('equipe').delete().eq('id', id);
            if (error) throw error;

            await this.recarregar();
        }, 'Membro removido.');
    },

    // ---------------------------------------------
    // EDITAR HORÁRIOS (médico e cuidador)
    // ---------------------------------------------
    editarMedicamento(id) {
        const p = this.getActive();
        const med = p && p.prescricoes.find(x => x.id === id);
        if (!med) return;

        this.state.editandoMedicamentoId = id;

        $('editar-med-nome').value = med.medicamento;
        $('editar-med-dose').value = med.dose;
        $('editar-med-hora').value = fmtHora(med.horario);

        this.openModal('modal-editar-medicamento');
    },

    async salvarEdicaoMedicamento(e) {
        e.preventDefault();

        const id = this.state.editandoMedicamentoId;
        const hora = $('editar-med-hora').value;
        if (!id || !hora) return;

        await this.tentar(async () => {
            const { error } = await supabaseClient
                .from('prescricoes').update({ horario: hora }).eq('id', id);
            if (error) throw error;

            // mantém a tarefa do checklist com o mesmo horário
            const { error: e2 } = await supabaseClient
                .from('tarefas').update({ hora }).eq('prescricao_id', id);
            if (e2) throw e2;

            this.state.editandoMedicamentoId = null;
            this.closeModal();
            await this.recarregar();
        }, 'Horário da medicação alterado!');
    },

    editarTarefa(id) {
        const p = this.getActive();
        const t = p && p.checklist.find(x => x.id === id);
        if (!t) return;

        this.state.editandoTarefaId = id;

        $('editar-tarefa-nome').innerText = t.tarefa;
        $('editar-tarefa-hora').value = fmtHora(t.hora);

        this.openModal('modal-editar-tarefa');
    },

    async salvarEdicaoTarefa(e) {
        e.preventDefault();

        const id = this.state.editandoTarefaId;
        const hora = $('editar-tarefa-hora').value;
        if (!id || !hora) return;

        await this.tentar(async () => {
            const { error } = await supabaseClient
                .from('tarefas').update({ hora }).eq('id', id);
            if (error) throw error;

            this.state.editandoTarefaId = null;
            this.closeModal();
            await this.recarregar();
        }, 'Horário da tarefa alterado!');
    },

    // ---------------------------------------------
    // GRÁFICO (só aparece se existir <canvas id="evolucaoChart">)
    // ---------------------------------------------
    initChart(p) {
        const canvas = $('evolucaoChart');
        if (!canvas || typeof Chart === 'undefined') return;

        if (this.state.chart) this.state.chart.destroy();

        this.state.chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: p.cognicao.map((_, i) => `Avaliação ${i + 1}`),
                datasets: [{
                    label: 'Pontuação MMSE',
                    data: p.cognicao,
                    borderColor: '#6366f1',
                    borderWidth: 4,
                    pointRadius: 6,
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(99, 102, 241, 0.05)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { min: 0, max: 30 } }
            }
        });
    },

    // ---------------------------------------------
    // MODAIS E AVISOS
    // ---------------------------------------------
    openModal(id) {
        $('modal-container').classList.remove('hidden-el');
        $(id).classList.remove('hidden-el');
    },

    closeModal() {
        $('modal-container').classList.add('hidden-el');

        document.querySelectorAll('#modal-container > div')
            .forEach(m => m.classList.add('hidden-el'));
    },

    showToast(m) {
        const t = $('toast');
        const text = $('toast-text');
        if (!t || !text) return;

        text.innerText = m;
        t.classList.remove('hidden-el');

        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => t.classList.add('hidden-el'), 3500);
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
