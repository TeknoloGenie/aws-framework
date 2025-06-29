// React/JavaScript WebSocket Client Example
class WebSocketClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.listeners = {};
    }

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log("WebSocket connected");
            this.emit("connected");
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.emit("message", data);
            this.emit(data.action, data.data);
        };

        this.ws.onclose = () => {
            console.log("WebSocket disconnected");
            this.emit("disconnected");
        };

        this.ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            this.emit("error", error);
        };
    }

    // Send CRUD operations
    create(data) {
        this.send("create", data);
    }

    update(data) {
        this.send("update", data);
    }

    delete(data) {
        this.send("delete", data);
    }

    send(action, data) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ action, ...data }));
        }
    }

    // Event listeners
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Usage Examples:

// Chat Messages WebSocket
const chatWS = new WebSocketClient("wss://your-chat-websocket-url/prod");

chatWS.on("connected", () => {
    console.log("Chat connected");
});

chatWS.on("create", (message) => {
    console.log("New message:", message);
    // Update UI with new message
});

chatWS.connect();

// Send a chat message
chatWS.create({
    roomId: "room1",
    message: "Hello World!",
    timestamp: Date.now()
});

// Notifications WebSocket
const notificationWS = new WebSocketClient("wss://your-notifications-websocket-url/prod");

notificationWS.on("create", (notification) => {
    // Show notification in UI
    showNotification(notification);
});

notificationWS.on("update", (notification) => {
    // Update existing notification
    updateNotification(notification);
});

notificationWS.connect();

// React Hook Example
function useWebSocket(url) {
    const [ws, setWs] = useState(null);
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        const client = new WebSocketClient(url);

        client.on("message", (data) => {
            setMessages(prev => [...prev, data]);
        });

        client.connect();
        setWs(client);

        return () => client.disconnect();
    }, [url]);

    return { ws, messages };
}
