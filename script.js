const SUPABASE_URL = "https://hfvjtwhfzvnqdkhhmbyh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iiz4_ldEhGT7EwwjE76gcA_Qy0NRmvu";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

const app = {
    state: {
        userType: null,
        userName: null,
        activePacienteId: 0,
        activeTab: 'prescricoes',
        pacientes: [
            {
                id: 0,
                nome: "Augusto Ferreira",
                idade: 78,
                estagio: "Moderada",
                telefone: "(11) 98888-7766",
                cognicao: [24, 25, 23, 24, 22],
                prescricoes: [
                    {
                        id: 1,
                        medicamento: "Rivastigmina",
                        dose: "4.5mg",
                        hora: "08:00"
                    }
                ],
                checklist: [
                    {
                        id: 101,
                        tarefa: "Fisioterapia Respiratória",
                        concluida: false,
                        hora: "10:00"
                    }
                ],
                equipe: [
                    {
                        id: 1,
                        nome: "Dra. Ana Paula",
                        cargo: "Fisioterapeuta"
                    }
                ],
                exames: [],
                mood: null,
                incidentes: []
            }
        ]
    },

    init() {
        this.renderSelectors();
    },

    getActive() {
        return this.state.pacientes.find(p => p.id == this.state.activePacienteId);
    },

    switchPaciente(id) {
        this.state.activePacienteId = parseInt(id);
        this.refreshUI();
    },

    refreshUI() {
        const p = this.getActive();
        if (!p) return;

        if (this.state.userType === 'medico') {
            document.getElementById('area-medico')?.classList.remove('hidden-el');
            document.getElementById('area-cuidador')?.classList.add('hidden-el');
            this.renderMedicoUI();
        } else {
            document.getElementById('area-cuidador')?.classList.remove('hidden-el');
            document.getElementById('area-medico')?.classList.add('hidden-el');
            
            const nomeEl = document.getElementById('cuidador-paciente-nome');
            const infoEl = document.getElementById('cuidador-paciente-info');
            if (nomeEl) nomeEl.innerText = p.nome;
            if (infoEl) infoEl.innerText = `${p.idade} anos • Gravidade ${p.estagio}`;
            
            this.renderCuidadorUI();
        }
    },

    async selectMood(type, icon, label) {
        const p = this.getActive();
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const { data, error } = await supabaseClient
            .from('humor')
            .insert([
                {
                    id_paciente: p ? p.id : 0,
                    nivel_humor: `${icon} ${label}`,
                    data_hora: new Date().toISOString()
                }
            ]);

        if (error) {
            console.error("Erro no Supabase (humor):", error);
            this.showToast("Erro ao gravar humor!");
            return;
        }

        p.mood = { type, icon, label, time: now };
        this.renderCuidadorUI();
        this.showToast(`Humor "${label}" gravado!`);
    },

    async addPrescricao(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const p = this.getActive();
        const med = fd.get('med');
        const dose = fd.get('dose');
        const hora = fd.get('hora');

        const { data, error } = await supabaseClient
            .from('prescricoes')
            .insert([
                {
                    id_paciente: p ? p.id : 0,
                    medicamento: med,
                    dosagem: dose,
                    horario: hora
                }
            ]);

        if (error) {
            console.error("Erro no Supabase (prescricoes):", error);
        }

        const novoId = Date.now();
        p.prescricoes.push({ id: novoId, medicamento: med, dose: dose, hora: hora });
        p.checklist.push({ id: novoId + 1, tarefa: `Medicamento: ${med}`, concluida: false, hora: hora });

        this.closeModal();
        this.refreshUI();
        this.showToast("Medicação prescrita e gravada!");
        e.target.reset();
    },

    async sendIntercorrencia(e) {
        e.preventDefault();
        const tipo = document.getElementById('inc-tipo').value;
        const desc = document.getElementById('inc-desc').value;
        const p = this.getActive();

        const { data, error } = await supabaseClient
            .from('incidentes')
            .insert([
                {
                    id_paciente: p ? p.id : 0,
                    tipo: tipo,
                    descricao: desc,
                    data_hora: new Date().toISOString()
                }
            ]);

        if (error) {
            console.error("Erro no Supabase (incidentes):", error);
        }

        if (!p.incidentes) p.incidentes = [];
        p.incidentes.push({ id: Date.now(), tipo, desc, data: new Date().toLocaleDateString() });

        this.closeModal();
        this.showToast(`Incidente (${tipo}) registrado!`);
        document.getElementById('inc-desc').value = '';
    },

    async addPaciente(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const novoId = Date.now();
        const nome = fd.get('nome');
        const idade = fd.get('idade') || 70;
        const estagio = fd.get('estagio');
        const telefone = fd.get('telefone');

        const { data, error } = await supabaseClient
            .from('pacientes')
            .insert([
                {
                    nome: nome,
                    estagio: estagio,
                    telefone: telefone
                }
            ]);

        if (error) {
            console.error("Erro no Supabase (pacientes):", error);
        }

        this.state.pacientes.push({
            id: novoId,
            nome,
            idade,
            estagio,
            telefone,
            cognicao: [30],
            prescricoes: [],
            checklist: [],
            equipe: [],
            exames: [],
            mood: null,
            incidentes: []
        });

        this.renderSelectors();
        this.state.activePacienteId = novoId;
        this.closeModal();
        this.refreshUI();
        this.showToast("Paciente cadastrado!");
        e.target.reset();
    },

    renderMedicoUI() {
        const p = this.getActive();
        if (!p) return;

        const moodHtml = p.mood
            ? `
                <div class="flex items-center space-x-2 mt-2 bg-indigo-50 p-2 rounded-xl">
                    <span class="text-xl">${p.mood.icon}</span>
                    <span class="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">
                        ${p.mood.label} às ${p.mood.time}
                    </span>
                </div>
            `
            : `
                <p class="text-[9px] font-bold text-slate-300 mt-2 italic uppercase">
                    Sem reporte de humor
                </p>
            `;

        const statsEl = document.getElementById('medico-stats');
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="bg-white p-6 rounded-[2rem] border-l-4 border-indigo-500 card-shadow">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Humor Recente</p>
                    ${moodHtml}
                </div>
                <div class="bg-white p-6 rounded-[2rem] border-l-4 border-indigo-500 card-shadow">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contato Emergência</p>
                    <h4 class="text-sm font-black text-indigo-600 mt-1">${p.telefone}</h4>
                </div>
                <div class="bg-white p-6 rounded-[2rem] border-l-4 border-emerald-500 card-shadow">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status Geral</p>
                    <h4 class="text-sm font-black text-emerald-600 mt-1">Estável</h4>
                </div>
            `;
        }

        this.renderPrescricoes(p);
        this.renderExames(p);
        this.renderRotinaMedico(p);
        this.renderEquipeMedico(p);
        this.initChart(p);
    },

    renderCuidadorUI() {
        const p = this.getActive();
        if (!p) return;

        const listaMedicacoes = document.getElementById('cuidador-medicacoes-lista');
        if (listaMedicacoes) {
            listaMedicacoes.innerHTML = p.prescricoes.map(med => `
                <div class="flex items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-xl">
                            <i class="fas fa-pills"></i>
                        </div>
                        <div>
                            <p class="text-sm font-black text-slate-700">${med.medicamento}</p>
                            <p class="text-xs text-slate-400 font-medium">${med.dose}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-black text-indigo-500">${med.hora}</span>
                    </div>
                </div>
            `).join('');
        }

        document.querySelectorAll('.emoji-btn').forEach(btn => btn.classList.remove('active'));
        const statusDiv = document.getElementById('mood-status');

        if (p.mood && statusDiv) {
            statusDiv.classList.remove('hidden-el');
            const labelEl = document.getElementById('mood-label');
            if (labelEl) labelEl.innerText = `${p.mood.icon} ${p.mood.label} (${p.mood.time})`;
            const btn = document.getElementById(`mood-${p.mood.type}`);
            if (btn) btn.classList.add('active');
        } else if (statusDiv) {
            statusDiv.classList.add('hidden-el');
        }

        const checklistEl = document.getElementById('cuidador-checklist');
        if (checklistEl) {
            checklistEl.innerHTML = [...p.checklist]
                .sort((a, b) => a.hora.localeCompare(b.hora))
                .map(i => `
                    <div class="flex items-center justify-between p-5 rounded-[2rem] border-2 transition-all ${i.concluida ? 'bg-slate-50 border-slate-50 opacity-60' : 'bg-white border-indigo-50 shadow-sm'}">
                        <div class="flex items-center space-x-4">
                            <button onclick="app.toggleCheck(${i.id})" class="w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all ${i.concluida ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-indigo-100 text-indigo-100 hover:border-indigo-500'}">
                                <i class="fas fa-check"></i>
                            </button>
                            <div>
                                <p class="font-bold text-sm ${i.concluida ? 'text-slate-400 line-through' : 'text-slate-700'}">${i.tarefa}</p>
                                <span class="text-[9px] font-black text-indigo-400 tracking-widest uppercase">${i.hora}</span>
                            </div>
                        </div>
                    </div>
                `).join('');
        }

        const progresoEl = document.getElementById('progresso-diario');
        if (progresoEl) {
            const done = p.checklist.filter(i => i.concluida).length;
            progresoEl.innerText = `${done}/${p.checklist.length} concluídos hoje`;
        }
    },

    renderPrescricoes(p) {
        const body = document.getElementById('medico-prescricoes-body');
        if (!body) return;
        body.innerHTML = p.prescricoes.map(pr => `
            <tr>
                <td class="py-4 font-bold text-sm text-slate-700">${pr.medicamento}</td>
                <td class="py-4 text-xs font-medium text-slate-500">${pr.dose}</td>
                <td class="py-4 text-xs font-black text-slate-400">${pr.hora}</td>
                <td class="py-4">
                    <button onclick="app.removePres(${pr.id})" class="text-slate-300 hover:text-red-500">
                        <i class="fas fa-minus-circle"></i>
                    </button>
                </td>
            </tr>
        `).join('') || `<tr><td colspan="4" class="py-10 text-center text-xs text-slate-400 italic">Sem prescrições</td></tr>`;
    },

    renderExames(p) {
        const el = document.getElementById('medico-exames-lista');
        if (!el) return;
        el.innerHTML = p.exames.map(ex => `
            <div class="bg-slate-50 p-5 rounded-3xl border border-slate-200">
                <div class="flex justify-between mb-3">
                    <i class="fas fa-file-medical text-indigo-500"></i>
                    <span class="text-[9px] font-black text-slate-300">${ex.data}</span>
                </div>
                <h5 class="font-black text-slate-800 text-xs">${ex.nome}</h5>
            </div>
        `).join('') || `<p class="col-span-full text-center py-10 text-slate-300 text-[10px] font-black uppercase">Aguardando exames...</p>`;
    },

    renderRotinaMedico(p) {
        const el = document.getElementById('medico-rotina-lista');
        if (!el) return;
        el.innerHTML = p.checklist.map(t => `
            <div class="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl">
                <div>
                    <p class="text-sm font-bold text-slate-700">${t.tarefa}</p>
                    <span class="text-[9px] font-black text-indigo-400 uppercase">${t.hora}</span>
                </div>
                <button onclick="app.removeTask(${t.id})" class="text-slate-200 hover:text-red-500">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    },

    renderEquipeMedico(p) {
        const el = document.getElementById('medico-equipe-lista');
        if (!el) return;
        el.innerHTML = p.equipe.map(m => `
            <div class="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <i class="fas fa-user-md"></i>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-slate-700">${m.nome}</p>
                        <span class="text-[9px] font-black text-slate-400 uppercase">${m.cargo}</span>
                    </div>
                </div>
                <button onclick="app.removeMember(${m.id})" class="text-slate-200 hover:text-red-500">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('') || `<p class="col-span-full text-center py-6 text-slate-300 text-xs font-bold italic uppercase">Sem equipe vinculada</p>`;
    },

    toggleCheck(id) {
        const p = this.getActive();
        const i = p.checklist.find(x => x.id === id);
        if (i) i.concluida = !i.concluida;
        this.renderCuidadorUI();
    },

    removePres(id) {
        const p = this.getActive();
        p.prescricoes = p.prescricoes.filter(x => x.id !== id);
        this.renderPrescricoes(p);
    },

    removeTask(id) {
        const p = this.getActive();
        p.checklist = p.checklist.filter(x => x.id !== id);
        this.renderRotinaMedico(p);
    },

    removeMember(id) {
        const p = this.getActive();
        p.equipe = p.equipe.filter(x => x.id !== id);
        this.renderEquipeMedico(p);
    },

    addMember(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const p = this.getActive();
        p.equipe.push({ id: Date.now(), nome: fd.get('nome'), cargo: fd.get('cargo') });
        this.closeModal();
        this.renderEquipeMedico(p);
        this.showToast("Membro adicionado!");
        e.target.reset();
    },

    addExame(e) {
        e.preventDefault();
        const p = this.getActive();
        p.exames.unshift({
            id: Date.now(),
            nome: document.getElementById('exame-nome').value,
            data: document.getElementById('exame-data').value
        });
        e.target.reset();
        this.renderCuidadorUI();
        this.showToast("Exame enviado!");
    },

    addTask(e) {
        e.preventDefault();
        const p = this.getActive();
        p.checklist.push({
            id: Date.now(),
            tarefa: document.getElementById('task-name').value,
            concluida: false,
            hora: "12:00"
        });
        e.target.reset();
        this.renderMedicoUI();
        this.showToast("Atividade agendada!");
    },

    renderSelectors() {
        const s = document.getElementById('select-global-paciente');
        if (!s) return;
        s.innerHTML = this.state.pacientes.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
    },

    switchTab(tab) {
        document.querySelectorAll('.tab-view').forEach(v => v.classList.add('hidden-el'));
        document.querySelectorAll('button[id^="tab-"]').forEach(t => t.classList.remove('tab-active'));
        document.getElementById(`view-${tab}`)?.classList.remove('hidden-el');
        document.getElementById(`tab-${tab}`)?.classList.add('tab-active');
    },

    initChart(p) {
        const canvas = document.getElementById('evolucaoChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (this.state.chart) this.state.chart.destroy();

        this.state.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: p.cognicao.map((_, i) => `Mês ${i + 1}`),
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

    openModal(id) {
        document.getElementById('modal-container')?.classList.remove('hidden-el');
        document.getElementById(id)?.classList.remove('hidden-el');
    },

    closeModal() {
        document.getElementById('modal-container')?.classList.add('hidden-el');
        document.querySelectorAll('#modal-container > div').forEach(m => m.classList.add('hidden-el'));
    },

    showToast(m) {
        const t = document.getElementById('toast');
        const text = document.getElementById('toast-text');
        if (!t || !text) return;
        text.innerText = m;
        t.classList.remove('hidden-el');
        setTimeout(() => t.classList.add('hidden-el'), 3000);
    },

    logout() {
        sessionStorage.removeItem("vivamenteUserType");
        sessionStorage.removeItem("vivamenteUserName");
        window.location.href = "login.html";
    }
};

document.addEventListener("DOMContentLoaded", function () {
    const userType = sessionStorage.getItem("vivamenteUserType");
    const userName = sessionStorage.getItem("vivamenteUserName");

    if (!userType) {
        window.location.href = "login.html";
        return;
    }

    if (typeof app !== "undefined") {
        app.state.userType = userType;
        app.state.userName = userName;
        if (typeof app.init === "function") app.init();

        const badgeEl = document.getElementById("badge-perfil");
        if (badgeEl) {
            badgeEl.innerText = `${userType} (${userName || 'Usuário'})`;
            badgeEl.className = userType === "medico"
                ? "ml-4 px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full bg-indigo-100 text-indigo-700"
                : "ml-4 px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full bg-emerald-100 text-emerald-700";
        }

        app.refreshUI();
    }
});
