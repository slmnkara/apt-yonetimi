import { authService } from "../services/AuthService.js";
import { commandManager } from "../core/CommandManager.js";
import { DebtCommand } from "../commands/DebtCommand.js";
import { PayDebtCommand } from "../commands/PayDebtCommand.js";
import { TransactionCommand } from "../commands/TransactionCommand.js";
import { eventBus } from "../core/EventManager.js";
import { dbService } from "../services/DbService.js";

export class UIManager {
    constructor() {
        this.data = { transactions: [] };
        this.els = {
            loading: document.getElementById('loadingScreen'),
            loginView: document.getElementById('loginView'),
            adminView: document.getElementById('adminView'),
            // Modallar
            modalIncome: document.getElementById('modalIncome'),
            modalEdit: document.getElementById('modalEditMesken'),
            modalReport: document.getElementById('modalReport'),
            modalDebt: document.getElementById('modalDebt'),
            modalAddFlat: document.getElementById('modalAddFlat'),
            modalConfirm: document.getElementById('modalConfirm'),
            confirmTitle: document.getElementById('confirmTitle'),
            confirmMessage: document.getElementById('confirmMessage'),
            btnApproveConfirm: document.getElementById('btnApproveConfirm'),
            // Listeler
            kasaList: document.getElementById('kasaList'),
            meskenTable: document.getElementById('meskenTableBody'),
            // Formlar
            kasaType: document.getElementById('kasaType'),
            kasaDesc: document.getElementById('kasaDesc'),
            kasaAmount: document.getElementById('kasaAmount'),
            // Edit Inputs
            editId: document.getElementById('editMeskenId'),
            editName: document.getElementById('editSakinAdi'),
            editNo: document.getElementById('editDaireNo'),
            // Borç Inputs
            debtDesc: document.getElementById('debtDesc'),
            debtAmount: document.getElementById('debtAmount'),
            debtTarget: document.getElementById('debtTarget'),
            // Yeni Daire Inputs
            newFlatName: document.getElementById('newFlatName'),
            newFlatNo: document.getElementById('newFlatNo'),
            // Rapor Inputs
            reportStart: document.getElementById('reportStartDate'),
            reportEnd: document.getElementById('reportEndDate'),
            printArea: document.getElementById('printArea'),
            // Butonlar
            btnConfirmReport: document.getElementById('btnConfirmReport'),
            btnPrint: document.getElementById('btnPrintReport'),
            btnOpenIncome: document.getElementById('btnOpenIncomeModal'),
            btnSaveKasa: document.getElementById('btnSaveKasaIslem'),
            btnSaveEdit: document.getElementById('btnSaveMeskenEdit'),
            btnUndo: document.getElementById('globalUndoBtn'),
            btnLogout: document.getElementById('btnLogout'),
            loginForm: document.getElementById('loginForm'),
            btnOpenDebt: document.getElementById('btnOpenDebtModal'),
            btnSaveDebt: document.getElementById('btnSaveDebt'),
            btnOpenAddFlat: document.getElementById('btnOpenAddFlatModal'),
            btnSaveNewFlat: document.getElementById('btnSaveNewFlat')
        };

        this.initListeners();
        this.initSubscribers();
    }

    // --- OLAY DİNLEYİCİLERİ ---
    initListeners() {
        // 1. Genel Modal Kapatma
        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // 2. Kasa İşlemleri
        if (this.els.btnOpenIncome) {
            this.els.btnOpenIncome.addEventListener('click', () => {
                this.els.modalIncome.classList.remove('hidden-view');
            });
        }
        if (this.els.btnSaveKasa) {
            this.els.btnSaveKasa.addEventListener('click', () => this.handleSaveKasa());
        }

        // 3. Sakin Düzenle Kaydet
        if (this.els.btnSaveEdit) {
            this.els.btnSaveEdit.addEventListener('click', async () => {
                const id = this.els.editId.value;
                const ad = this.els.editName.value;
                const no = this.els.editNo.value;
                if (!ad || !no) return this.showToast("Eksik bilgi", "error");

                await dbService.updateResident(id, { sakin_adi: ad, kod: no });
                this.closeAllModals();
                this.showToast("Bilgiler güncellendi.");
            });
        }

        // 4. Geri Al Butonu (GÜNCELLENDİ)
        if (this.els.btnUndo) {
            this.els.btnUndo.addEventListener('click', () => {
                // Confirm Modalı ile soruyoruz
                this.showConfirm(
                    "İşlemi Geri Al",
                    "Son yaptığınız işlemi geri almak üzeresiniz. Onaylıyor musunuz?",
                    () => {
                        commandManager.undo();
                    }
                );
            });
        }

        // 5. Login / Logout
        if (this.els.loginForm) {
            this.els.loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.toggleLoading(true);
                authService.login(document.getElementById('email').value, document.getElementById('password').value);
            });
        }
        if (this.els.btnLogout) {
            this.els.btnLogout.addEventListener('click', () => {
                this.showConfirm(
                    "Çıkış Yap",
                    "Oturumunuz sonlandırılacak. Emin misiniz?",
                    () => {
                        authService.logout();
                    }
                );
            });
        }

        // 6. Rapor Butonları
        if (this.els.btnPrint) {
            this.els.btnPrint.addEventListener('click', () => {
                const today = new Date().toISOString().split('T')[0];
                this.els.reportStart.value = today;
                this.els.reportEnd.value = today;
                this.els.modalReport.classList.remove('hidden-view');
            });
        }
        if (this.els.btnConfirmReport) {
            this.els.btnConfirmReport.addEventListener('click', () => {
                this.handlePrintReport();
                this.closeAllModals();
            });
        }

        // 7. Borç Ekleme
        if (this.els.btnOpenDebt) {
            this.els.btnOpenDebt.addEventListener('click', () => {
                this.els.modalDebt.classList.remove('hidden-view');
            });
        }
        if (this.els.btnSaveDebt) {
            this.els.btnSaveDebt.addEventListener('click', () => this.handleSaveDebt());
        }

        // 8. Yeni Daire Ekleme
        if (this.els.btnOpenAddFlat) {
            this.els.btnOpenAddFlat.addEventListener('click', () => {
                this.els.modalAddFlat.classList.remove('hidden-view');
            });
        }
        if (this.els.btnSaveNewFlat) {
            this.els.btnSaveNewFlat.addEventListener('click', async () => {
                const ad = this.els.newFlatName.value;
                const no = this.els.newFlatNo.value;
                if (!ad || !no) return this.showToast("Eksik bilgi", "error");

                await dbService.addResident(ad, no);
                this.els.newFlatName.value = "";
                this.els.newFlatNo.value = "";
                this.closeAllModals();
                this.showToast("Daire eklendi.");
            });
        }

        // 9. TABLO TIKLAMALARI (Event Delegation)
        this.els.meskenTable.addEventListener('click', (e) => {
            const btnEdit = e.target.closest('.btn-edit-resident');
            const btnDelete = e.target.closest('.btn-delete-resident');
            const btnLink = e.target.closest('.btn-copy-link');

            if (btnEdit) {
                const data = JSON.parse(decodeURIComponent(btnEdit.dataset.resident));
                this.openEditModal(data);
            }

            if (btnDelete) {
                const dbId = btnDelete.dataset.id;

                this.showConfirm(
                    "Daireyi Kalıcı Olarak Sil", // Başlık
                    "DİKKAT: Bu işlem geri alınamaz! Daireye ait tüm borç ve ödeme geçmişi silinecektir. Devam etmek istiyor musunuz?",
                    async () => {
                        this.toggleLoading(true);
                        try {
                            await dbService.deleteResident(dbId);
                            this.showToast("Daire silindi.");
                        } catch (err) {
                            console.error(err);
                            this.showToast("Silme hatası", "error");
                        }
                        this.toggleLoading(false);
                    }
                );
            }

            if (btnLink) {
                const urlCode = btnLink.dataset.url;
                const fullUrl = `${window.location.origin}${window.location.pathname}?id=${urlCode}`;
                navigator.clipboard.writeText(fullUrl).then(() => {
                    this.showToast("Link kopyalandı!");
                }).catch(err => {
                    console.error(err);
                    this.showToast("Kopyalama hatası", "error");
                });
            }
        });

        // 10. TEKİL BORÇ ÖDEME (Edit Modalı İçin)
        const editDebtList = document.getElementById('editBorcList');
        if (editDebtList) {
            editDebtList.addEventListener('click', (e) => {
                const btnPay = e.target.closest('.btn-pay-single-debt');
                if (btnPay) {
                    const debtData = JSON.parse(decodeURIComponent(btnPay.dataset.debt));
                    const residentId = this.els.editId.value;
                    this.handlePayDebt(residentId, debtData);
                }
            });
        }
    }

    // --- EVENT BUS ABONELİKLERİ ---
    initSubscribers() {
        eventBus.subscribe('AUTH_STATE_CHANGED', (state) => {
            this.toggleLoading(false);
            if (state.isLoggedIn) {
                this.els.loginView.classList.add('hidden-view');
                this.els.adminView.classList.remove('hidden-view');
                if (document.getElementById('adminEmailLabel'))
                    document.getElementById('adminEmailLabel').innerText = state.user.email;
            } else {
                this.els.loginView.classList.remove('hidden-view');
                this.els.adminView.classList.add('hidden-view');
            }
        });

        eventBus.subscribe('BALANCE_UPDATED', (val) => {
            document.getElementById('kasaBakiye').innerText = `${val} ₺`;
        });

        eventBus.subscribe('TRANSACTIONS_UPDATED', (list) => this.renderTransactions(list));
        eventBus.subscribe('RESIDENTS_UPDATED', (list) => this.renderResidents(list));

        eventBus.subscribe('LOGIN_ERROR', (err) => {
            this.toggleLoading(false);
            this.showToast("Giriş hatası: " + err.code, "error");
        });

        eventBus.subscribe('SHOW_TOAST', (payload) => {
            this.showToast(payload.message, payload.type);
        });
    }

    // --- RENDER FONKSİYONLARI ---
    renderTransactions(list) {
        this.data.transactions = list;
        this.els.kasaList.innerHTML = list.slice(0, 50).map(item => {
            const isGelir = item.tur === 'gelir';
            const color = isGelir ? 'text-green-500' : 'text-red-500';
            const icon = isGelir ? '+' : '-';
            const style = item.is_correction ? 'text-gray-500 line-through' : 'text-gray-300';

            return `
                <li class="flex justify-between items-center bg-gray-900/50 p-2 rounded border border-gray-700/50">
                    <div class="flex flex-col">
                        <span class="${style} text-sm">${item.aciklama}</span>
                        <span class="text-[10px] text-gray-500">${item.tarih}</span>
                    </div>
                    <span class="${color} font-mono font-bold text-sm">${icon}${item.tutar} ₺</span>
                </li>
            `;
        }).join('');
    }

    renderResidents(list) {
        this.els.meskenTable.innerHTML = list.map(m => {
            // JSON verisini güvenli hale getir
            const jsonStr = encodeURIComponent(JSON.stringify(m));

            return `
                <tr class="border-b border-gray-700 hover:bg-gray-700/30 transition">
                    <td class="p-3 font-bold text-indigo-400">${m.kod}</td>
                    <td class="p-3 text-white">${m.sakin_adi}</td>
                    <td class="p-3 text-sm text-gray-500">
                        ${(m.borclar && m.borclar.length > 0)
                    ? `<span class="text-red-400 font-bold">Borçlu</span>`
                    : `<span class="text-green-400 flex items-center gap-1"><i class="fas fa-check-circle"></i> Temiz</span>`}
                    </td>
                    <td class="p-3 text-right flex justify-end gap-2">
                        <button class="btn-copy-link text-indigo-400 hover:text-indigo-300 p-2" title="Linki Kopyala" data-url="${m.mesken_url}">
                            <i class="fas fa-link"></i>
                        </button>
                        
                        <button class="btn-edit-resident text-blue-400 hover:text-blue-300 p-2" data-resident='${jsonStr}'>
                            <i class="fas fa-pen"></i>
                        </button>
                        
                        <button class="btn-delete-resident text-red-400 hover:text-red-300 p-2" data-id="${m.dbId}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // --- MODAL & İŞLEM ---
    handleSaveKasa() {
        const type = this.els.kasaType.value;
        const desc = this.els.kasaDesc.value;
        const amount = this.els.kasaAmount.value;

        if (!desc || !amount) return this.showToast("Eksik bilgi", "error");

        const cmd = new TransactionCommand({ tur: type, aciklama: desc, tutar: amount });
        commandManager.execute(cmd).then(() => {
            this.closeAllModals();
            this.els.kasaDesc.value = "";
            this.els.kasaAmount.value = "";
            this.showToast("İşlem kaydedildi.");
        });
    }

    async handleSaveDebt() {
        const desc = this.els.debtDesc.value;
        const amount = this.els.debtAmount.value;
        const targetType = this.els.debtTarget.value;

        if (!desc || !amount) return this.showToast("Eksik bilgi", "error");

        let targetIds = [];
        if (targetType === 'all') {
            // DOM'dan butonları bularak ID topluyoruz
            document.querySelectorAll('.btn-delete-resident').forEach(btn => {
                targetIds.push(btn.dataset.id);
            });
        }

        if (targetIds.length === 0) return this.showToast("Borçlandırılacak daire yok.", "error");

        this.toggleLoading(true);
        const cmd = new DebtCommand(targetIds, { aciklama: desc, tutar: amount });
        await commandManager.execute(cmd);

        this.toggleLoading(false);
        this.closeAllModals();
        this.els.debtDesc.value = "";
        this.els.debtAmount.value = "";
        // Toast mesajı CommandManager'dan da gelebilir ama burada özel mesaj verebiliriz
        this.showToast(`${targetIds.length} daire borçlandırıldı.`);
    }

    async handlePayDebt(residentId, debtObj) {
        // Eski confirm kodu yerine:
        this.showConfirm(
            "Tahsilat Onayı",
            `${debtObj.tutar} TL tutarındaki borç tahsil edilecek. Onaylıyor musunuz?`,
            async () => {
                // EVET'e basılınca çalışacak kodlar:
                this.toggleLoading(true);
                const cmd = new PayDebtCommand(residentId, debtObj);
                await commandManager.execute(cmd);

                this.toggleLoading(false);
                this.closeAllModals();
                this.showToast("Tahsilat başarıyla yapıldı.");
            }
        );
    }

    openEditModal(data) {
        this.els.editId.value = data.dbId;
        this.els.editName.value = data.sakin_adi;
        this.els.editNo.value = data.kod;

        // Borç Listesi
        const listContainer = document.getElementById('editBorcList');
        listContainer.innerHTML = '';

        if (data.borclar && data.borclar.length > 0) {
            data.borclar.forEach(borc => {
                const jsonDebt = encodeURIComponent(JSON.stringify(borc));
                listContainer.innerHTML += `
                <div class="flex justify-between items-center bg-gray-800 p-3 rounded border border-gray-700 text-sm mb-2">
                    <div>
                        <div class="text-white font-medium">${borc.aciklama}</div>
                        <div class="text-xs text-gray-500">${borc.tarih}</div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-red-400 font-bold">${borc.tutar} ₺</span>
                        <button class="btn-pay-single-debt bg-green-700 hover:bg-green-600 text-white text-xs px-2 py-1 rounded transition" 
                                title="Tahsil Et" data-debt="${jsonDebt}">
                            <i class="fas fa-check"></i> Öde
                        </button>
                    </div>
                </div>
            `;
            });
        } else {
            listContainer.innerHTML = '<p class="text-gray-500 text-sm italic text-center py-2">Kayıtlı borç yok.</p>';
        }

        this.els.modalEdit.classList.remove('hidden-view');
    }

    closeAllModals() {
        this.els.modalIncome.classList.add('hidden-view');
        this.els.modalEdit.classList.add('hidden-view');
        this.els.modalReport.classList.add('hidden-view');
        this.els.modalDebt?.classList.add('hidden-view');
        this.els.modalAddFlat?.classList.add('hidden-view');
        this.els.modalConfirm?.classList.add('hidden-view'); // <--- YENİ
    }

    toggleLoading(show) {
        if (show) this.els.loading.classList.remove('hidden-view');
        else this.els.loading.classList.add('hidden-view');
    }

    // --- SAKİN EKRANI ---
    showResidentView(data) {
        this.toggleLoading(false);
        this.els.loginView.classList.add('hidden-view');
        this.els.adminView.classList.add('hidden-view');
        document.getElementById('residentView').classList.remove('hidden-view');

        document.getElementById('resSakinAdi').innerText = data.sakin_adi;
        document.getElementById('resDaireNo').innerText = `Daire: ${data.kod}`;

        const unpaidDiv = document.getElementById('resUnpaidList');
        unpaidDiv.innerHTML = '';
        if (data.borclar && data.borclar.length > 0) {
            data.borclar.forEach(b => {
                unpaidDiv.innerHTML += `
                    <div class="flex justify-between items-center bg-red-900/20 p-3 rounded border border-red-900/50 mb-2 text-gray-300">
                        <div><div class="font-bold">${b.aciklama}</div><div class="text-xs text-gray-500">${b.tarih}</div></div>
                        <div class="font-bold text-red-400">${b.tutar} ₺</div>
                    </div>`;
            });
        } else {
            unpaidDiv.innerHTML = '<p class="text-gray-500 italic">Ödenmemiş borcunuz bulunmamaktadır.</p>';
        }

        const historyBody = document.getElementById('resHistoryBody');
        historyBody.innerHTML = '';
        if (data.odemeler) {
            data.odemeler.reverse().forEach(o => {
                historyBody.innerHTML += `
                    <tr class="border-b border-gray-700">
                        <td class="p-2 text-gray-400">${o.odeme_tarihi}</td>
                        <td class="p-2 text-gray-300">${o.aciklama}</td>
                        <td class="p-2 text-right font-bold text-gray-300">${o.tutar} ₺</td>
                    </tr>`;
            });
        }
    }

    // --- RAPORLAMA ---
    async handlePrintReport() {
        const startVal = this.els.reportStart.value;
        const endVal = this.els.reportEnd.value;

        if (!startVal || !endVal) return this.showToast("Tarih aralığı seçin", "error");

        this.toggleLoading(true);

        try {
            const filtered = await dbService.getTransactionsByDate(startVal, endVal);
            this.toggleLoading(false);

            if (filtered.length === 0) return this.showToast("Kayıt bulunamadı.", "error");

            // Rapor HTML oluşturma (Önceki kodun aynısı)
            let gelir = 0, gider = 0;
            const sDateTR = startVal.split('-').reverse().join('.');
            const eDateTR = endVal.split('-').reverse().join('.');

            let html = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333;">
                <div style="text-align:center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
                    <h1 style="margin:0; font-size: 24px;">Apartman Kasa Raporu</h1>
                    <p style="margin: 5px 0 0 0; color:#666; font-size: 14px;">${sDateTR} - ${eDateTR}</p>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr style="background-color:#f3f4f6; text-align:left;">
                            <th style="border:1px solid #e5e7eb; padding:10px;">Tarih</th>
                            <th style="border:1px solid #e5e7eb; padding:10px;">Açıklama</th>
                            <th style="border:1px solid #e5e7eb; padding:10px;">Tür</th>
                            <th style="border:1px solid #e5e7eb; padding:10px; text-align:right;">Tutar</th>
                        </tr>
                    </thead>
                    <tbody>`;

            filtered.forEach(item => {
                const val = parseFloat(item.tutar);
                if (item.tur === 'gelir') gelir += val; else gider += val;
                const isCancel = item.is_correction;
                const rowStyle = isCancel ? 'color:#9ca3af; text-decoration:line-through;' : '';
                const typeColor = item.tur === 'gelir' ? 'color:#16a34a' : 'color:#dc2626';
                const typeText = item.tur === 'gelir' ? 'GELİR' : 'GİDER';

                html += `
                    <tr style="${rowStyle}">
                        <td style="border:1px solid #e5e7eb; padding:8px;">${item.tarih}</td>
                        <td style="border:1px solid #e5e7eb; padding:8px;">${item.aciklama} ${isCancel ? '(İPTAL)' : ''}</td>
                        <td style="border:1px solid #e5e7eb; padding:8px; font-weight:bold; ${!isCancel ? typeColor : ''}">${typeText}</td>
                        <td style="border:1px solid #e5e7eb; padding:8px; text-align:right; font-family:monospace;">${val.toFixed(2)} ₺</td>
                    </tr>`;
            });

            const net = gelir - gider;
            const netColor = net >= 0 ? 'color:#16a34a' : 'color:#dc2626';

            html += `</tbody></table>
                <div style="margin-top:30px; display:flex; justify-content:flex-end;">
                    <table style="width:300px; border-collapse:collapse; text-align:right;">
                        <tr><td style="padding:5px; color:#666;">Toplam Gelir:</td><td style="padding:5px; font-weight:bold; color:#16a34a;">+${gelir.toFixed(2)} ₺</td></tr>
                        <tr><td style="padding:5px; color:#666;">Toplam Gider:</td><td style="padding:5px; font-weight:bold; color:#dc2626;">-${gider.toFixed(2)} ₺</td></tr>
                        <tr style="border-top: 2px solid #333;"><td style="padding:10px; font-weight:bold; font-size:16px;">NET BAKİYE:</td><td style="padding:10px; font-weight:bold; font-size:16px; ${netColor}">${net.toFixed(2)} ₺</td></tr>
                    </table>
                </div>
            </div>`;

            this.els.printArea.innerHTML = html;
            window.print();
        } catch (error) {
            this.toggleLoading(false);
            console.error(error);
            this.showToast("Rapor oluşturulamadı", "error");
        }
    }

    // --- GENEL ONAY MODALI ---
    showConfirm(title, message, onConfirmCallback) {
        // İçeriği doldur
        this.els.confirmTitle.innerText = title;
        this.els.confirmMessage.innerText = message;

        // Modalı aç
        this.els.modalConfirm.classList.remove('hidden-view');

        // Onay butonuna tıklanınca ne olacağını belirle
        // Önemli: onclick kullanıyoruz ki önceki event listenerlar birikmesin.
        this.els.btnApproveConfirm.onclick = () => {
            onConfirmCallback(); // Asıl işlemi yap
            this.els.modalConfirm.classList.add('hidden-view'); // Modalı kapat
        };

        // Vazgeç butonuna tıklanınca (Sadece kapatır)
        const cancelBtn = this.els.modalConfirm.querySelector('.btn-close-confirm');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                this.els.modalConfirm.classList.add('hidden-view');
            };
        }
    }

    // --- TOAST BİLDİRİM ---
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        const colors = type === 'success' ? 'bg-green-600' : 'bg-red-600';
        toast.className = `${colors} text-white px-4 py-3 rounded shadow-lg transition-all duration-500 transform translate-y-10 opacity-0 flex items-center gap-2`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check' : 'fa-exclamation-circle'}"></i> ${message}`;
        container.appendChild(toast);

        setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 10);
        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
}