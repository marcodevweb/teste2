document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('chat-messages');

    // Enable/disable send button
    messageInput.addEventListener('input', () => {
        if (messageInput.value.trim().length > 0) {
            sendBtn.classList.add('active');
        } else {
            sendBtn.classList.remove('active');
        }
    });

    // Send message on Enter
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);

    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;

        // Add user message
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        appendMessage(text, 'sender', timeString);
        messageInput.value = '';
        sendBtn.classList.remove('active');

        // Scroll to bottom
        scrollToBottom();
    }

    function appendMessage(text, type, time) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${type}`;

        let innerHTML = '';
        
        if (type === 'receiver') {
            innerHTML += `<img src="SaveInta.com_688760702_18098701861922501_8266598103887159661_n.jpg" alt="Anna" class="chat-avatar">`;
        } else {
            innerHTML += `<img src="SaveInta.com_688760702_18098701861922501_8266598103887159661_n.jpg" alt="You" class="chat-avatar" style="visibility:hidden; width:0; margin:0;">`;
        }

        innerHTML += `
            <div class="message-content">
                <p>${text}</p>
                <span class="timestamp">${time}</span>
            </div>
        `;
        
        wrapper.innerHTML = innerHTML;
        messagesContainer.appendChild(wrapper);
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});
