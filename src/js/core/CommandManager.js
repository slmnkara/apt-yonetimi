import { eventBus } from "./EventManager.js";

export class CommandManager {
    constructor() {
        this.history = [];
    }

    async execute(command) {
        try {
            await command.execute(); // İşlemi yap
            this.history.push(command); // Listeye ekle
            console.log(`Komut İşlendi: ${command.constructor.name}`);
            // Başarılı olduğunda (Opsiyonel: Her işlemde toast çıkarmak sıkabilir, bunu komutu çağıran yere bırakabiliriz veya burada genel bir başarı mesajı yayınlayabiliriz)
        } catch (err) {
            console.error("Komut Hatası:", err);
            // Alert yerine EventBus
            eventBus.publish('SHOW_TOAST', { message: "İşlem başarısız: " + err.message, type: 'error' });
        }
    }

    async undo() {
        const command = this.history.pop();
        if (!command) {
            // Alert yerine EventBus
            eventBus.publish('SHOW_TOAST', { message: "Geri alınacak işlem yok.", type: 'warning' });
            return;
        }

        try {
            await command.undo(); // Ters işlemi yap
            console.log(`Komut Geri Alındı: ${command.constructor.name}`);
            // Alert yerine EventBus
            eventBus.publish('SHOW_TOAST', { message: "İşlem geri alındı.", type: 'success' });
        } catch (err) {
            console.error("Geri Alma Hatası:", err);
            this.history.push(command); 
            eventBus.publish('SHOW_TOAST', { message: "Geri alma başarısız oldu.", type: 'error' });
        }
    }
}

export const commandManager = new CommandManager();