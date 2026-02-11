/**
 * Exemplo de código cliente que demonstra como interromper uma geração em andamento
 * 
 * Este código exemplifica:
 * 1. Como iniciar uma geração de texto com streaming
 * 2. Como parar a geração a qualquer momento
 */

// Configuração da API
const API_BASE_URL = 'http://localhost:3000';
let activeConnection = null;
let activeConnectionId = null;
const userId = 1; // Substitua pelo ID do usuário real

// Função para iniciar uma geração de texto
function startTextGeneration() {
  // Se já existir uma conexão ativa, interrompe
  if (activeConnection) {
    stopGeneration();
  }
  
  const prompt = document.getElementById('prompt').value || 'Escreva uma história sobre um gato aventureiro';
  
  console.log('Iniciando geração de texto com prompt:', prompt);
  
  // Parâmetros da requisição
  const params = new URLSearchParams({
    prompt,
    userId: userId.toString(),
    streaming: 'true',
    model: 'equilibrado' // Você pode alterar para 'baixo' ou 'otimo' conforme necessário
  });
  
  // Cria uma nova conexão EventSource
  activeConnection = new EventSource(`${API_BASE_URL}/ai/generate-text?${params}`);
  
  // Elemento para exibir a resposta
  const outputElement = document.getElementById('output');
  outputElement.textContent = 'Gerando...';
  
  // Manipuladores de eventos
  activeConnection.onopen = () => {
    console.log('Conexão estabelecida');
  };
  
  activeConnection.onerror = (error) => {
    console.error('Erro na conexão:', error);
    stopGeneration();
    outputElement.textContent += '\n\nErro na conexão. Por favor, tente novamente.';
  };
  
  activeConnection.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Se receber o ID da conexão
      if (data.status === 'conectado' && data.connectionId) {
        activeConnectionId = data.connectionId;
        console.log('ID da conexão:', activeConnectionId);
      }
      
      // Se receber texto
      if (data.text) {
        outputElement.textContent += data.text;
      }
      
      // Se receber erro
      if (data.error) {
        outputElement.textContent += `\n\nErro: ${data.error}`;
        stopGeneration();
      }
      
      // Se a geração for concluída
      if (data.done) {
        console.log('Geração concluída');
        activeConnection.close();
        activeConnection = null;
        document.getElementById('stopButton').disabled = true;
        document.getElementById('generateButton').disabled = false;
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error, event.data);
    }
  };
  
  // Atualiza o estado dos botões
  document.getElementById('stopButton').disabled = false;
  document.getElementById('generateButton').disabled = true;
}

// Função para interromper a geração em andamento
function stopGeneration() {
  if (!activeConnection) {
    console.log('Nenhuma geração ativa para interromper');
    return;
  }
  
  // Fecha a conexão EventSource
  activeConnection.close();
  
  // Se tivermos o ID da conexão, notifica o servidor
  if (activeConnectionId) {
    console.log('Interrompendo geração com ID:', activeConnectionId);
    
    // Envia uma requisição para interromper a geração no servidor
    fetch(`${API_BASE_URL}/ai/stop-generation?connectionId=${activeConnectionId}&userId=${userId}`)
      .then(response => response.json())
      .then(data => {
        console.log('Resposta da interrupção:', data);
      })
      .catch(error => {
        console.error('Erro ao interromper geração:', error);
      });
  }
  
  // Limpa as variáveis de estado
  activeConnection = null;
  activeConnectionId = null;
  
  // Atualiza o estado dos botões
  document.getElementById('stopButton').disabled = true;
  document.getElementById('generateButton').disabled = false;
  
  // Adiciona uma mensagem indicando que a geração foi interrompida
  const outputElement = document.getElementById('output');
  outputElement.textContent += '\n\n[Geração interrompida pelo usuário]';
}

// Código para inicializar a página HTML
document.addEventListener('DOMContentLoaded', () => {
  // Verifica se os elementos existem no DOM
  if (!document.getElementById('generateForm')) {
    // Se não existirem, cria a estrutura básica da página
    document.body.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <h1>Exemplo de Geração de Texto com Interrupção</h1>
        
        <form id="generateForm">
          <div style="margin-bottom: 20px;">
            <label for="prompt" style="display: block; margin-bottom: 5px;">Prompt:</label>
            <textarea id="prompt" style="width: 100%; height: 100px; padding: 8px; border-radius: 4px; border: 1px solid #ccc;" 
              placeholder="Escreva uma história sobre um gato aventureiro"></textarea>
          </div>
          
          <div style="margin-bottom: 20px;">
            <button type="button" id="generateButton" style="padding: 10px 20px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
              Gerar Texto
            </button>
            <button type="button" id="stopButton" style="padding: 10px 20px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;" disabled>
              Parar Geração
            </button>
          </div>
        </form>
        
        <div style="margin-top: 20px;">
          <h2>Resultado:</h2>
          <pre id="output" style="white-space: pre-wrap; background-color: #f5f5f5; padding: 15px; border-radius: 4px; min-height: 200px;"></pre>
        </div>
      </div>
    `;
  }
  
  // Adiciona os event listeners aos botões
  document.getElementById('generateButton').addEventListener('click', startTextGeneration);
  document.getElementById('stopButton').addEventListener('click', stopGeneration);
}); 