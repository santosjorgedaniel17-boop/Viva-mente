const app = {
    editarTarefa(id) {

        const p = this.getActive();
    
        const tarefa = p.checklist.find(
            x => x.id === id
        );
    
        if (!tarefa) return;
    
        this.editandoTarefaId = id;
    
        document.getElementById(
            'editar-tarefa-hora'
        ).value = tarefa.hora;
    
        this.openModal(
            'modal-editar-tarefa'
        );
    },
    
    salvarEdicaoTarefa(e) {
    
        e.preventDefault();
    
        const p = this.getActive();
    
        const tarefa = p.checklist.find(
            x => x.id === this.editandoTarefaId
        );
    
        if (!tarefa) return;
    
        tarefa.hora =
            document.getElementById(
                'editar-tarefa-hora'
            ).value;
    
        this.closeModal();
    
        this.renderCuidadorUI();
    
        this.showToast(
            "Horário da tarefa atualizado!"
        );
    
        this.editandoTarefaId = null;
    },
    state: {
        userType: null,
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
                mood: null
            }
        ]
    },
    selecionarData(data) {
        this.state.dataAcompanhamento = data;
    
        this.renderCuidadorUI();
    
        this.showToast(
            `Acompanhamento do dia ${data.split('-').reverse().join('/')} selecionado!`
        );
    },

    init() {
        this.renderSelectors();
    },

    goToLogin(type) {
        window.location.href = `login.html?tipo=${type}`;
    },

    getLoginType() {
        const params = new URLSearchParams(window.location.search);

        return params.get('tipo') || 'medico';
    },

    renderLoginForm() {
        const tipo = this.getLoginType();

        const title = document.getElementById('login-title');
        const subtitle = document.getElementById('login-subtitle');
        const button = document.getElementById('login-button');
        const icon = document.getElementById('login-icon');
        const form = document.getElementById('login-form');

        if (!form) return;

        title.innerText =
            tipo === 'medico'
                ? 'Entrar como Médico'
                : 'Entrar como Cuidador';

        subtitle.innerText =
            tipo === 'medico'
                ? 'Acesse o painel clínico'
                : 'Acesse o monitoramento diário';

        button.innerText = 'Entrar';

        button.className = `
            w-full
            text-white
            py-4
            rounded-2xl
            font-black
            text-sm
            transition-all
            ${
                tipo === 'medico'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
            }
        `;

        icon.className = `
            w-20
            h-20
            rounded-3xl
            flex
            items-center
            justify-center
            mx-auto
            mb-6
            text-white
            text-4xl
            shadow-xl
            ${
                tipo === 'medico'
                    ? 'bg-indigo-600 shadow-indigo-200'
                    : 'bg-emerald-600 shadow-emerald-200'
            }
        `;

        icon.innerHTML = `
            <i class="${
                tipo === 'medico'
                    ? 'fas fa-user-md'
                    : 'fas fa-user-nurse'
            }"></i>
        `;

        form.onsubmit = (e) => {
            e.preventDefault();

            const usuario =
                document.getElementById('login-user').value.trim();

            const senha =
                document.getElementById('login-pass').value.trim();

            if (!usuario || !senha) {
                this.showToast('Preencha usuário e senha.');
                return;
            }

            sessionStorage.setItem(
                'vivamenteUserType',
                tipo
            );

            window.location.href = 'index.html';
        };
    },
    
    logout() {
            sessionStorage.removeItem("vivamenteUserType");
            sessionStorage.removeItem("vivamenteUserName");
            window.location.href = "login.html";
            
            
        this.state.userType = null;

        sessionStorage.removeItem(
            'vivamenteUserType'
        );

        document
            .getElementById('login-overlay')
            .classList
            .remove('hidden-el');

        document
            .getElementById('main-nav')
            .classList
            .add('hidden-el');

        document
            .getElementById('area-medico')
            .classList
            .add('hidden-el');

        document
            .getElementById('area-cuidador')
            .classList
            .add('hidden-el');
    },

    getActive() {
        return this.state.pacientes.find(
            p => p.id == this.state.activePacienteId
        );
    },

    switchPaciente(id) {
        this.state.activePacienteId =
            parseInt(id);

        this.refreshUI();
    },

    refreshUI() {
        const p = this.getActive();

        if (this.state.userType === 'medico') {

            document
                .getElementById('area-medico')
                .classList
                .remove('hidden-el');

            document
                .getElementById('area-cuidador')
                .classList
                .add('hidden-el');

            this.renderMedicoUI();

        } else {

            document
                .getElementById('area-cuidador')
                .classList
                .remove('hidden-el');

            document
                .getElementById('area-medico')
                .classList
                .add('hidden-el');

            document
                .getElementById('cuidador-paciente-nome')
                .innerText = p.nome;

            document
                .getElementById('cuidador-paciente-info')
                .innerText =
                    `${p.idade} anos • Gravidade ${p.estagio}`;

            this.renderCuidadorUI();
        }
    },

    renderMedicoUI() {
        const p = this.getActive();

        const moodHtml = p.mood
            ? `
                <div class="flex items-center space-x-2 mt-2 bg-indigo-50 p-2 rounded-xl">
                    <span class="text-xl">
                        ${p.mood.icon}
                    </span>

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

        document
            .getElementById('medico-stats')
            .innerHTML = `

            <div class="bg-white p-6 rounded-[2rem] border-l-4 border-indigo-500 card-shadow">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Humor Recente
                </p>

                ${moodHtml}
            </div>

            <div class="bg-white p-6 rounded-[2rem] border-l-4 border-indigo-500 card-shadow">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Contato Emergência
                </p>

                <h4 class="text-sm font-black text-indigo-600 mt-1">
                    ${p.telefone}
                </h4>
            </div>

            <div class="bg-white p-6 rounded-[2rem] border-l-4 border-emerald-500 card-shadow">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Status Geral
                </p>

                <h4 class="text-sm font-black text-emerald-600 mt-1">
                    Estável
                </h4>
            </div>
        `;

        this.renderPrescricoes(p);
        this.renderExames(p);
        this.renderRotinaMedico(p);
        this.renderEquipeMedico(p);
        this.initChart(p);
    },

    renderCuidadorUI() {
        const listaMedicacoes =
    document.getElementById(
        'cuidador-medicacoes-lista'
    );

if (listaMedicacoes) {

    listaMedicacoes.innerHTML =
        p.prescricoes
            .map(med => `

                <div class="
                    flex
                    items-center
                    justify-between
                    gap-4
                    p-4
                    bg-slate-50
                    border
                    border-slate-100
                    rounded-2xl
                ">

                    <div class="flex items-center gap-3">

                        <div class="
                            w-10
                            h-10
                            flex
                            items-center
                            justify-center
                            bg-indigo-100
                            text-indigo-600
                            rounded-xl
                        ">
                            <i class="fas fa-pills"></i>
                        </div>

                        <div>

                            <p class="
                                text-sm
                                font-black
                                text-slate-700
                            ">
                                ${med.medicamento}
                            </p>

                            <p class="
                                text-xs
                                text-slate-400
                                font-medium
                            ">
                                ${med.dose}
                            </p>

                        </div>

                    </div>

                    <div class="
                        flex
                        items-center
                        gap-3
                    ">

                        <span class="
                            text-xs
                            font-black
                            text-indigo-500
                        ">
                            ${med.hora}
                        </span>

                        <button
                            onclick="
                                app.editarMedicacao(
                                    ${med.id}
                                )
                            "
                            class="
                                w-9
                                h-9
                                flex
                                items-center
                                justify-center
                                bg-white
                                border
                                border-slate-200
                                rounded-xl
                                text-indigo-500
                                hover:bg-indigo-50
                            "
                            title="Alterar horário"
                        >
                            <i class="fas fa-edit"></i>
                        </button>

                    </div>

                </div>

            `)
            .join('');
}

        const p = this.getActive();

        document
            .querySelectorAll('.emoji-btn')
            .forEach(btn => {
                btn.classList.remove('active');
            });

        const statusDiv =
            document.getElementById('mood-status');

        if (p.mood) {

            statusDiv
                .classList
                .remove('hidden-el');

            document
                .getElementById('mood-label')
                .innerText =
                    `${p.mood.icon} ${p.mood.label} (${p.mood.time})`;

            const btnId =
                `mood-${p.mood.type}`;

            const btn =
                document.getElementById(btnId);

            if (btn) {
                btn.classList.add('active');
            }

        } else {

            statusDiv
                .classList
                .add('hidden-el');
        }

        document
            .getElementById('cuidador-checklist')
            .innerHTML = [...p.checklist]
                .sort(
                    (a, b) =>
                        a.hora.localeCompare(b.hora)
                )
                .map(i => `

                    <div class="
                        flex
                        items-center
                        justify-between
                        p-5
                        rounded-[2rem]
                        border-2
                        transition-all
                        ${
                            i.concluida
                                ? 'bg-slate-50 border-slate-50 opacity-60'
                                : 'bg-white border-indigo-50 shadow-sm'
                        }
                    ">

                        <div class="flex items-center space-x-4">

                            <button
                                onclick="app.toggleCheck(${i.id})"
                                class="
                                    w-12
                                    h-12
                                    rounded-2xl
                                    border-2
                                    flex
                                    items-center
                                    justify-center
                                    transition-all
                                    ${
                                        i.concluida
                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                            : 'border-indigo-100 text-indigo-100 hover:border-indigo-500'
                                    }
                                "
                            >
                                <i class="fas fa-check"></i>
                            </button>

                            <div>

                                <p class="
                                    font-bold
                                    text-sm
                                    ${
                                        i.concluida
                                            ? 'text-slate-400 line-through'
                                            : 'text-slate-700'
                                    }
                                ">
                                    ${i.tarefa}
                                </p>

                                <span class="
                                    text-[9px]
                                    font-black
                                    text-indigo-400
                                    tracking-widest
                                    uppercase
                                ">
                                    ${i.hora}
                                </span>

                            </div>

                        </div>

                    </div>
                `)
                .join('');

        document
            .getElementById('cuidador-exames-lista')
            .innerHTML = p.exames
                .map(ex => `

                    <div class="
                        flex
                        items-center
                        space-x-3
                        p-3
                        bg-slate-50
                        rounded-2xl
                        border
                        border-slate-100
                    ">

                        <i class="
                            fas
                            fa-file-alt
                            text-slate-400
                        "></i>

                        <div class="flex-1 overflow-hidden">
                            <p class="
                                text-[10px]
                                font-black
                                text-slate-800
                                truncate
                            ">
                                ${ex.nome}
                            </p>
                        </div>

                        <button
                            onclick="app.removeExame(${ex.id})"
                            class="
                                text-slate-300
                                hover:text-red-500
                            "
                        >
                            <i class="fas fa-times"></i>
                        </button>

                    </div>
                `)
                .join('');

        document
            .getElementById('cuidador-equipe-lista')
            .innerHTML = p.equipe
                .map(m => `

                    <div class="
                        flex
                        items-center
                        space-x-3
                        p-4
                        bg-slate-50
                        rounded-2xl
                    ">

                        <div class="
                            w-8
                            h-8
                            bg-white
                            rounded-lg
                            flex
                            items-center
                            justify-center
                            text-indigo-500
                            shadow-sm
                        ">
                            <i class="
                                fas
                                fa-stethoscope
                                text-[10px]
                            "></i>
                        </div>

                        <div>

                            <p class="
                                text-[10px]
                                font-black
                                text-slate-700
                            ">
                                ${m.nome}
                            </p>

                            <p class="
                                text-[8px]
                                font-bold
                                text-slate-400
                                uppercase
                            ">
                                ${m.cargo}
                            </p>

                        </div>

                    </div>
                `)
                .join('');

        const done =
            p.checklist.filter(
                i => i.concluida
            ).length;

        document
            .getElementById('progresso-diario')
            .innerText =
                `${done}/${p.checklist.length} concluídos hoje`;
    },
    
    selectMood(type, icon, label) {
        const p = this.getActive();

        const now =
            new Date()
                .toLocaleTimeString(
                    [],
                    {
                        hour: '2-digit',
                        minute: '2-digit'
                    }
                );

        p.mood = {
            type,
            icon,
            label,
            time: now
        };

        this.renderCuidadorUI();

        this.showToast(
            `Humor "${label}" registrado!`
        );
    },

    addPaciente(e) {
        e.preventDefault();

        const fd =
            new FormData(e.target);

        const novoId =
            Date.now();

        this.state.pacientes.push({

            id: novoId,

            nome:
                fd.get('nome'),

            idade:
                fd.get('idade'),

            estagio:
                fd.get('estagio'),

            telefone:
                fd.get('telefone'),

            cognicao: [30],

            prescricoes: [],

            checklist: [],

            equipe: [],

            exames: [],

            mood: null
        });

        this.renderSelectors();

        this.state.activePacienteId =
            novoId;

        this.closeModal();

        this.refreshUI();

        this.showToast(
            "Paciente cadastrado!"
        );

        e.target.reset();
    },

    addPrescricao(e) {
        e.preventDefault();

        const fd =
            new FormData(e.target);

        const p =
            this.getActive();

        const med =
            fd.get('med');

        const hora =
            fd.get('hora');

        p.prescricoes.push({
            id: Date.now(),
            medicamento: med,
            dose: fd.get('dose'),
            hora: hora
        });

        p.checklist.push({
            id: Date.now() + 1,
            tarefa: `Medicamento: ${med}`,
            concluida: false,
            hora: hora
        });

        this.closeModal();

        this.refreshUI();

        this.showToast(
            "Medicação prescrita!"
        );
    },

    addMember(e) {
        e.preventDefault();

        const fd =
            new FormData(e.target);

        const p =
            this.getActive();

        p.equipe.push({
            id: Date.now(),
            nome: fd.get('nome'),
            cargo: fd.get('cargo')
        });

        this.closeModal();

        this.renderEquipeMedico(p);

        this.showToast(
            "Membro adicionado!"
        );

        e.target.reset();
    },

    addExame(e) {
        e.preventDefault();

        const p =
            this.getActive();

        p.exames.unshift({
            id: Date.now(),

            nome:
                document
                    .getElementById('exame-nome')
                    .value,

            data:
                document
                    .getElementById('exame-data')
                    .value
        });

        e.target.reset();

        this.renderCuidadorUI();

        this.showToast(
            "Exame enviado!"
        );
    },

    addTask(e) {
        e.preventDefault();

        const p =
            this.getActive();

        p.checklist.push({

            id:
                Date.now(),

            tarefa:
                document
                    .getElementById('task-name')
                    .value,

            concluida:
                false,

            hora:
                document
                    .getElementById('task-time')
                    .value
        });

        e.target.reset();

        this.renderMedicoUI();

        this.showToast(
            "Atividade agendada!"
        );
    },

    toggleCheck(id) {
        const p =
            this.getActive();

        const i =
            p.checklist.find(
                x => x.id === id
            );

        i.concluida =
            !i.concluida;

        this.renderCuidadorUI();
    },

    renderPrescricoes(p) {
        document
            .getElementById(
                'medico-prescricoes-body'
            )
            .innerHTML = p.prescricoes
                .map(pr => `

                    <tr>

                        <td class="
                            py-4
                            font-bold
                            text-sm
                            text-slate-700
                        ">
                            ${pr.medicamento}
                        </td>

                        <td class="
                            py-4
                            text-xs
                            font-medium
                            text-slate-500
                        ">
                            ${pr.dose}
                        </td>

                        <td class="
                            py-4
                            text-xs
                            font-black
                            text-slate-400
                        ">
                            ${pr.hora}
                        </td>

                        <td class="py-4">

                            <button
                                onclick="app.removePres(${pr.id})"
                                class="
                                    text-slate-300
                                    hover:text-red-500
                                "
                            >
                                <i class="
                                    fas
                                    fa-minus-circle
                                "></i>
                            </button>

                        </td>

                    </tr>
                `)
                .join('') ||

            `
                <tr>
                    <td
                        colspan="4"
                        class="
                            py-10
                            text-center
                            text-xs
                            text-slate-400
                            italic
                        "
                    >
                        Sem prescrições
                    </td>
                </tr>
            `;
    },

    renderExames(p) {
        document
            .getElementById(
                'medico-exames-lista'
            )
            .innerHTML = p.exames
                .map(ex => `

                    <div class="
                        bg-slate-50
                        p-5
                        rounded-3xl
                        border
                        border-slate-200
                    ">

                        <div class="
                            flex
                            justify-between
                            mb-3
                        ">

                            <i class="
                                fas
                                fa-file-medical
                                text-indigo-500
                            "></i>

                            <span class="
                                text-[9px]
                                font-black
                                text-slate-300
                            ">
                                ${ex.data}
                            </span>

                        </div>

                        <h5 class="
                            font-black
                            text-slate-800
                            text-xs
                        ">
                            ${ex.nome}
                        </h5>

                    </div>
                `)
                .join('') ||

            `
                <p class="
                    col-span-full
                    text-center
                    py-10
                    text-slate-300
                    text-[10px]
                    font-black
                    uppercase
                ">
                    Aguardando exames...
                </p>
            `;
    },

    renderRotinaMedico(p) {
        document
            .getElementById(
                'medico-rotina-lista'
            )
            .innerHTML = p.checklist
                .map(t => `

                    <div class="
                        flex
                        items-center
                        justify-between
                        p-4
                        bg-white
                        border
                        border-slate-100
                        rounded-2xl
                    ">

                        <div>

                            <p class="
                                text-sm
                                font-bold
                                text-slate-700
                            ">
                                ${t.tarefa}
                            </p>

                            <span class="
                                text-[9px]
                                font-black
                                text-indigo-400
                                uppercase
                            ">
                                ${t.hora}
                            </span>

                        </div>

                        <button
                            onclick="app.removeTask(${t.id})"
                            class="
                                text-slate-200
                                hover:text-red-500
                            "
                        >
                            <i class="
                                fas
                                fa-trash
                            "></i>
                        </button>

                    </div>
                `)
                .join('');
    },

    renderEquipeMedico(p) {
        document
            .getElementById(
                'medico-equipe-lista'
            )
            .innerHTML = p.equipe
                .map(m => `

                    <div class="
                        group
                        flex
                        items-center
                        justify-between
                        p-4
                        bg-white
                        border
                        border-slate-100
                        rounded-2xl
                        hover:border-indigo-200
                        transition-all
                    ">

                        <div class="
                            flex
                            items-center
                            space-x-3
                        ">

                            <div class="
                                w-10
                                h-10
                                bg-indigo-50
                                rounded-xl
                                flex
                                items-center
                                justify-center
                                text-indigo-600
                            ">
                                <i class="
                                    fas
                                    fa-user-md
                                "></i>
                            </div>

                            <div>

                                <p class="
                                    text-sm
                                    font-bold
                                    text-slate-700
                                ">
                                    ${m.nome}
                                </p>

                                <span class="
                                    text-[9px]
                                    font-black
                                    text-slate-400
                                    uppercase
                                ">
                                    ${m.cargo}
                                </span>

                            </div>

                        </div>

                        <button
                            onclick="app.removeMember(${m.id})"
                            class="
                                text-slate-200
                                hover:text-red-500
                                opacity-0
                                group-hover:opacity-100
                            "
                        >
                            <i class="
                                fas
                                fa-times
                            "></i>
                        </button>

                    </div>
                `)
                .join('') ||

            `
                <p class="
                    col-span-full
                    text-center
                    py-6
                    text-slate-300
                    text-xs
                    font-bold
                    italic
                    uppercase
                ">
                    Sem equipe vinculada
                </p>
            `;
    },

    removePres(id) {
        const p = this.getActive();
    
        p.prescricoes =
            p.prescricoes.filter(
                x => x.id !== id
            );
    
        this.renderPrescricoes(p);
    },
    
    editarMedicamento(id) {
        const p = this.getActive();
    
        const med =
            p.prescricoes.find(
                x => x.id === id
            );
    
        if (!med) return;
    
        this.state.editandoMedicamentoId = id;
    
        document.getElementById('editar-med-nome').value =
            med.medicamento;
    
        document.getElementById('editar-med-dose').value =
            med.dose;
    
        document.getElementById('editar-med-hora').value =
            med.hora;
    
        this.openModal('modal-editar-medicamento');
    },
    
    salvarEdicaoMedicamento(e) {
        e.preventDefault();
    
        const p = this.getActive();
    
        const med =
            p.prescricoes.find(
                x =>
                    x.id ===
                    this.state.editandoMedicamentoId
            );
    
        if (!med) return;
    
        const novoHorario =
            document.getElementById(
                'editar-med-hora'
            ).value;
    
        med.hora = novoHorario;
    
        const tarefa =
            p.checklist.find(
                x =>
                    x.tarefa ===
                    `Medicamento: ${med.medicamento}`
            );
    
        if (tarefa) {
            tarefa.hora = novoHorario;
        }
    
        this.closeModal();
    
        this.renderMedicoUI();
    
        this.showToast(
            "Horário da medicação alterado!"
        );
    },
    
    editarTarefa(id) {
        const p = this.getActive();
    
        const tarefa =
            p.checklist.find(
                x => x.id === id
            );
    
        if (!tarefa) return;
    
        this.state.editandoTarefaId = id;
    
        document.getElementById(
            'editar-tarefa-nome'
        ).innerText =
            tarefa.tarefa;
    
        document.getElementById(
            'editar-tarefa-hora'
        ).value =
            tarefa.hora;
    
        this.openModal('modal-editar-tarefa');
    },
    
    salvarEdicaoTarefa(e) {
        e.preventDefault();
    
        const p = this.getActive();
    
        const tarefa =
            p.checklist.find(
                x =>
                    x.id ===
                    this.state.editandoTarefaId
            );
    
        if (!tarefa) return;
    
        tarefa.hora =
            document.getElementById(
                'editar-tarefa-hora'
            ).value;
    
        this.closeModal();
    
        this.renderMedicoUI();
    
        this.showToast(
            "Horário da tarefa alterado!"
        );
    },
    
    removeTask(id) {
        const p = this.getActive();
    
        p.checklist =
            p.checklist.filter(
                x => x.id !== id
            );
    
        this.renderRotinaMedico(p);
    },

    removeExame(id) {
        const p =
            this.getActive();

        p.exames =
            p.exames.filter(
                x => x.id !== id
            );

        this.renderCuidadorUI();
    },

    removeMember(id) {
        const p =
            this.getActive();

        p.equipe =
            p.equipe.filter(
                x => x.id !== id
            );

        this.renderEquipeMedico(p);
    },

    sendIntercorrencia(e) {
        e.preventDefault();

        const tipo =
            document
                .getElementById('inc-tipo')
                .value;

        const desc =
            document
                .getElementById('inc-desc')
                .value;

        const p =
            this.getActive();

        if (!p.incidentes) {
            p.incidentes = [];
        }

        p.incidentes.push({

            id:
                Date.now(),

            tipo,

            desc,

            data:
                new Date()
                    .toLocaleDateString()
        });

        this.closeModal();

        this.showToast(
            `Incidente (${tipo}) enviado com sucesso!`
        );

        document
            .getElementById('inc-desc')
            .value = '';
    },

    renderSelectors() {
        const s =
            document.getElementById(
                'select-global-paciente'
            );

        if (!s) return;

        s.innerHTML =
            this.state.pacientes
                .map(
                    p => `
                        <option value="${p.id}">
                            ${p.nome}
                        </option>
                    `
                )
                .join('');
    },

    switchTab(tab) {
        document
            .querySelectorAll('.tab-view')
            .forEach(v => {
                v.classList.add(
                    'hidden-el'
                );
            });

        document
            .querySelectorAll(
                'button[id^="tab-"]'
            )
            .forEach(t => {
                t.classList.remove(
                    'tab-active'
                );
            });

        document
            .getElementById(
                `view-${tab}`
            )
            .classList
            .remove('hidden-el');

        document
            .getElementById(
                `tab-${tab}`
            )
            .classList
            .add('tab-active');
    },

    initChart(p) {
        const canvas =
            document.getElementById(
                'evolucaoChart'
            );

        if (!canvas) return;

        const ctx =
            canvas.getContext('2d');

        if (this.state.chart) {
            this.state.chart.destroy();
        }

        this.state.chart =
            new Chart(ctx, {

                type: 'line',

                data: {

                    labels:
                        p.cognicao.map(
                            (_, i) =>
                                `Mês ${i + 1}`
                        ),

                    datasets: [
                        {
                            label:
                                'Pontuação MMSE',

                            data:
                                p.cognicao,

                            borderColor:
                                '#6366f1',

                            borderWidth:
                                4,

                            pointRadius:
                                6,

                            tension:
                                0.4,

                            fill:
                                true,

                            backgroundColor:
                                'rgba(99, 102, 241, 0.05)'
                        }
                    ]
                },

                options: {
                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    plugins: {
                        legend: {
                            display:
                                false
                        }
                    },

                    scales: {
                        y: {
                            min: 0,
                            max: 30
                        }
                    }
                }
            });
    },

    openModal(id) {
        document
            .getElementById(
                'modal-container'
            )
            .classList
            .remove('hidden-el');

        document
            .getElementById(id)
            .classList
            .remove('hidden-el');
    },

    closeModal() {
        document
            .getElementById(
                'modal-container'
            )
            .classList
            .add('hidden-el');

        document
            .querySelectorAll(
                '#modal-container > div'
            )
            .forEach(m => {
                m.classList.add(
                    'hidden-el'
                );
            });
    },

    showToast(m) {
        const t =
            document.getElementById(
                'toast'
            );

        const text =
            document.getElementById(
                'toast-text'
            );

        if (!t || !text) return;

        text.innerText = m;

        t.classList.remove(
            'hidden-el'
        );

        setTimeout(
            () => {
                t.classList.add(
                    'hidden-el'
                );
            },
            3000
        );
    }
};
document.addEventListener("DOMContentLoaded", function () {

    const userType =
        sessionStorage.getItem("vivamenteUserType");

    if (!userType) {
        window.location.href = "login.html";
        return;
    }

    if (typeof app !== "undefined") {

        app.state.userType = userType;

        if (typeof app.init === "function") {
            app.init();
        }

        const areaMedico =
            document.getElementById("area-medico");

        const areaCuidador =
            document.getElementById("area-cuidador");

        if (userType === "medico") {

            areaMedico.classList.remove("hidden-el");
            areaCuidador.classList.add("hidden-el");

        } else if (userType === "cuidador") {

            areaCuidador.classList.remove("hidden-el");
            areaMedico.classList.add("hidden-el");

        }

    }

});
