export class EventManager {
    constructor() {
        this.listeners = {};
    }

    // Olay dinle (Örn: "BAKIYE_GUNCELLENDI" olunca bana haber ver)
    subscribe(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    // Olay yayınla (Örn: "BAKIYE_GUNCELLENDI", yeni bakiye: 500)
    publish(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}

export const eventBus = new EventManager();