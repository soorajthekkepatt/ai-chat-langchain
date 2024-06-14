document.getElementById('send-button').addEventListener('click', async () => {
    const userInput = document.getElementById('user-input').value;
    if (!userInput) return;
  
    addMessage('user', userInput);
    document.getElementById('user-input').value = '';
  
    const chatHistory = Array.from(document.querySelectorAll('.chat-box div')).map((div) => ({
      role: div.classList.contains('user') ? 'user' : 'ai',
      content: div.textContent,
    }));
  
    try {
      const response = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatHistory, input: userInput }),
      });
  
      const data = await response.json();
      addMessage('ai', data.answer); // Correctly extract and display the answer
    } catch (error) {
      console.error('Error:', error);
      addMessage('ai', 'Something went wrong. Please try again.');
    }
  });
  
  function addMessage(role, content) {
    const chatBox = document.getElementById('chat-box');
    const message = document.createElement('div');
    message.className = role;
    message.textContent = content;
    chatBox.appendChild(message);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
  