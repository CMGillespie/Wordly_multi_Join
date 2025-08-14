// Wordly Join Script
document.addEventListener('DOMContentLoaded', () => {
  // DOM elements - Login page
  const loginPage = document.getElementById('login-page');
  const appPage = document.getElementById('app-page');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const credentialsForm = document.getElementById('credentials-form');
  const linkForm = document.getElementById('link-form');
  const loginStatus = document.getElementById('login-status');
  
  // DOM elements - App page
  const sessionIdDisplay = document.getElementById('session-id-display');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const endSessionBtn = document.getElementById('end-session-btn');
  const masterMuteBtn = document.getElementById('master-mute-btn');
  const addRecorderBtn = document.getElementById('add-recorder-btn');
  const recorderGrid = document.getElementById('recorder-grid');
  const browserWarning = document.getElementById('browser-warning');
  const noDeviceSupportMessage = document.getElementById('no-device-support');
  const globalCollapseBtn = document.getElementById('global-collapse-btn');
  
  // DOM elements - Preset controls
  const presetNameInput = document.getElementById('preset-name');
  const savePresetBtn = document.getElementById('save-preset-btn');
  const presetSelect = document.getElementById('preset-select');
  const loadPresetBtn = document.getElementById('load-preset-btn');
  const deletePresetBtn = document.getElementById('delete-preset-btn');
  
  // Application state
  const state = {
    sessionId: null,
    passcode: '',
    inputDevices: [],
    recorders: [],
    presets: {},
    allCollapsed: false,
    allMuted: false,
    audioContext: null,
    audioWorklets: {},
    sampleRate: 16000
  };
  
  // Define language mapping
  const languageMap = {
    'af': 'Afrikaans', 'sq': 'Albanian', 'ar': 'Arabic', 'hy': 'Armenian', 'bn': 'Bengali', 
    'bg': 'Bulgarian', 'zh-HK': 'Cantonese', 'ca': 'Catalan', 'zh-CN': 'Chinese (Simplified)', 
    'zh-TW': 'Chinese (Traditional)', 'hr': 'Croatian', 'cs': 'Czech', 'da': 'Danish', 
    'nl': 'Dutch', 'en': 'English (US)', 'en-AU': 'English (AU)', 'en-GB': 'English (UK)', 
    'et': 'Estonian', 'fi': 'Finnish', 'fr': 'French (FR)', 'fr-CA': 'French (CA)', 
    'ka': 'Georgian', 'de': 'German', 'el': 'Greek', 'gu': 'Gujarati', 'he': 'Hebrew', 
    'hi': 'Hindi', 'hu': 'Hungarian', 'is': 'Icelandic', 'id': 'Indonesian', 'ga': 'Irish', 
    'it': 'Italian', 'ja': 'Japanese', 'kn': 'Kannada', 'ko': 'Korean', 'lv': 'Latvian', 
    'lt': 'Lithuanian', 'mk': 'Macedonian', 'ms': 'Malay', 'mt': 'Maltese', 'no': 'Norwegian', 
    'fa': 'Persian', 'pl': 'Polish', 'pt': 'Portuguese (PT)', 'pt-BR': 'Portuguese (BR)', 
    'ro': 'Romanian', 'ru': 'Russian', 'sr': 'Serbian', 'sk': 'Slovak', 'sl': 'Slovenian', 
    'es': 'Spanish (ES)', 'es-MX': 'Spanish (MX)', 'sv': 'Swedish', 'tl': 'Tagalog', 
    'th': 'Thai', 'tr': 'Turkish', 'uk': 'Ukrainian', 'vi': 'Vietnamese', 'cy': 'Welsh', 
    'pa': 'Punjabi', 'sw': 'Swahili', 'ta': 'Tamil', 'ur': 'Urdu', 
    'zh': 'Chinese'
  };
  
  // Initialize the application
  init();
  
  // Interval check for device status
  setInterval(() => {
    state.recorders.forEach(recorder => {
      updateJoinButtonState(recorder);
    });
  }, 1000);

  // --- Initialization Functions ---
  function init() {
    setupTabs();
    setupLoginForms();
    setupPresetControls();
    setupAppControls();
    checkBrowserCompatibility();
    loadPresetsFromStorage();
    initializeAudioContext();
  }

  function checkBrowserCompatibility() {
    const isChromeBased = /Chrome/.test(navigator.userAgent) || /Edg/.test(navigator.userAgent);
    if (!isChromeBased) {
      browserWarning.style.display = 'block';
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      noDeviceSupportMessage.style.display = 'block';
      showNotification('Your browser does not support audio input selection.', 'error');
    }
  }

  function initializeAudioContext() {
    try {
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 'interactive',
        sampleRate: 44100
      });
      
      if (state.audioContext.audioWorklet) {
        // Will implement audio worklet code later if needed
      } else {
        console.warn('AudioWorklet not supported in this browser.');
      }
    } catch (error) {
      console.error('Failed to initialize Audio Context:', error);
      showNotification('Unable to initialize audio system. Please try a different browser.', 'error');
    }
  }

  function setupTabs() {
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        button.classList.add('active');
        const tabId = button.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
      });
    });
  }

  function setupLoginForms() {
    credentialsForm.addEventListener('submit', handleCredentialsForm);
    linkForm.addEventListener('submit', handleLinkForm);
  }

  function setupAppControls() {
    disconnectBtn.addEventListener('click', disconnectFromSession);
    endSessionBtn.addEventListener('click', confirmEndSession);
    masterMuteBtn.addEventListener('click', toggleMasterMute);
    addRecorderBtn.addEventListener('click', () => addNewRecorder());
    globalCollapseBtn.addEventListener('click', toggleAllRecorders);
  }

  function setupPresetControls() {
    savePresetBtn.addEventListener('click', savePreset);
    loadPresetBtn.addEventListener('click', loadSelectedPreset);
    deletePresetBtn.addEventListener('click', deleteSelectedPreset);
    
    const exportPresetBtn = document.getElementById('export-preset-btn');
    const importPresetBtn = document.getElementById('import-preset-btn');
    
    if (exportPresetBtn) {
      exportPresetBtn.addEventListener('click', exportPreset);
    }
    
    if (importPresetBtn) {
      importPresetBtn.addEventListener('click', importPreset);
    }
  }
  
  function exportPreset() {
    const presetName = presetSelect.value;
    if (!presetName) {
      showNotification('Please select a preset to export', 'error');
      return;
    }
  
    const preset = state.presets[presetName];
    if (!preset) {
      showNotification(`Preset "${presetName}" not found`, 'error');
      return;
    }
  
    const exportData = {
      name: presetName,
      exportDate: new Date().toISOString(),
      version: "1.0",
      preset: preset
    };
  
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `wordly-preset-${presetName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    showNotification(`Preset "${presetName}" exported successfully`, 'success');
  }
  
  function importPreset() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importData = JSON.parse(e.target.result);
          
          if (!importData.name || !importData.preset) {
            showNotification('Invalid preset file format', 'error');
            return;
          }
          
          const presetName = importData.name;
          const preset = importData.preset;
          
          if (state.presets[presetName]) {
            if (!confirm(`Preset "${presetName}" already exists. Do you want to overwrite it?`)) {
              return;
            }
          }
          
          if (!preset.recorders || !Array.isArray(preset.recorders)) {
            showNotification('Invalid preset structure - missing recorders', 'error');
            return;
          }
          
          state.presets[presetName] = preset;
          
          try {
            localStorage.setItem('wordlyJoinPresets', JSON.stringify(state.presets));
            updatePresetDropdown();
            presetSelect.value = presetName;
            showNotification(`Preset "${presetName}" imported successfully`, 'success');
          } catch (error) {
            console.error('Error saving imported preset:', error);
            showNotification('Error saving imported preset to storage', 'error');
          }
          
        } catch (error) {
          console.error('Error parsing preset file:', error);
          showNotification('Error reading preset file. Please check the file format.', 'error');
        }
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  }

  // --- Login and Session Management ---
  function handleCredentialsForm(e) {
    e.preventDefault();
    let inputSessionId = document.getElementById('session-id').value.trim();
    const inputPasscode = document.getElementById('passcode').value.trim();
    
    if (!isValidSessionId(inputSessionId)) {
      inputSessionId = formatSessionId(inputSessionId);
      if (!isValidSessionId(inputSessionId)) {
        showLoginError('Please enter a valid session ID in the format XXXX-0000');
        return;
      }
    }

    if (!inputPasscode) {
      showLoginError('Passcode is required for Join functionality');
      return;
    }
    
    processLogin(inputSessionId, inputPasscode);
  }

  function handleLinkForm(e) {
    e.preventDefault();
    const weblink = document.getElementById('weblink').value.trim();
    const { sessionId: parsedSessionId, passcode: parsedPasscode } = parseWeblink(weblink);
    
    if (!parsedSessionId) {
      showLoginError('Unable to extract session information from the provided link');
      return;
    }
    
    if (!parsedPasscode) {
      showLoginError('The link must contain a passcode for Join functionality');
      return;
    }
    
    processLogin(parsedSessionId, parsedPasscode);
  }

  function isValidSessionId(sessionId) {
    return /^[A-Za-z0-9]{4}-\d{4}$/.test(sessionId);
  }

  function formatSessionId(input) {
    const cleaned = input.replace(/[^A-Za-z0-9]/g, '');
    return cleaned.length === 8 ? `${cleaned.substring(0, 4)}-${cleaned.substring(4)}` : input;
  }

  function parseWeblink(weblink) {
    try {
      const url = new URL(weblink);
      let sessionId = null;
      let passcode = url.searchParams.get('key') || '';
      const pathParts = url.pathname.split('/').filter(part => part);
      if (pathParts.length > 0) {
        const potentialSessionId = pathParts[pathParts.length - 1];
        if (isValidSessionId(potentialSessionId)) {
          sessionId = potentialSessionId;
        } else if (potentialSessionId.length === 8) {
          const formatted = formatSessionId(potentialSessionId);
          if (isValidSessionId(formatted)) sessionId = formatted;
        }
      }
      return { sessionId, passcode };
    } catch (error) {
      console.error('Error parsing weblink:', error);
      return { sessionId: null, passcode: '' };
    }
  }

  function showLoginError(message) {
    loginStatus.textContent = message;
    loginStatus.className = 'status-message error';
  }

  function showLoginSuccess(message) {
    loginStatus.textContent = message;
    loginStatus.className = 'status-message success';
  }

  async function processLogin(sessionId, passcode) {
    showLoginSuccess('Fetching audio devices...');
    try {
      if (state.audioContext && state.audioContext.state === 'suspended') {
        await state.audioContext.resume();
      }
      
      await initializeAudioDevices();
      
      state.sessionId = sessionId;
      state.passcode = passcode;

      showLoginSuccess('Login successful! Connecting to session...');
      
      loginPage.style.display = 'none';
      appPage.style.display = 'flex';
      
      sessionIdDisplay.textContent = `Session: ${sessionId}`;
      
      if (state.recorders.length === 0) {
        addNewRecorder();
      }
      
      showNotification(`Connected to session ${sessionId}`, 'success');
    } catch (err) {
      showLoginError(`Failed to initialize audio devices: ${err.message}. Please grant microphone permission.`);
    }
  }

  async function initializeAudioDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      throw new Error("Media device enumeration not supported.");
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => track.enabled = false);
      
      state.permissionStream = stream;
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      state.inputDevices = devices.filter(device => device.kind === 'audioinput');
      
      if (state.inputDevices.length === 0) {
        console.warn("No audio input devices found.");
      } else {
        console.log(`Found ${state.inputDevices.length} audio input devices.`);
      }
      
      state.recorders.forEach(recorder => {
        const deviceSelect = recorder.element.querySelector('.device-select');
        if (deviceSelect) {
          populateDeviceSelect(deviceSelect, recorder.deviceId);
        }
      });
    } catch (error) {
      console.error('Error accessing audio devices:', error);
      throw new Error(error.name === 'NotAllowedError' ? 'Microphone permission denied.' : 'Could not access audio devices.');
    }
  }

  function disconnectFromSession() {
    console.log("Disconnecting from session...");
    
    state.recorders.forEach(recorder => {
      stopRecording(recorder);
      leaveRecorder(recorder, false);
    });

    recorderGrid.innerHTML = '';
    state.recorders = [];
    
    if (state.permissionStream) {
      state.permissionStream.getTracks().forEach(track => track.stop());
      state.permissionStream = null;
    }
    
    credentialsForm.reset();
    linkForm.reset();
    
    appPage.style.display = 'none';
    loginPage.style.display = 'flex';
    
    state.sessionId = null;
    state.passcode = '';
    state.allMuted = false;
    masterMuteBtn.textContent = 'Mute All';
    masterMuteBtn.classList.remove('muted');
    
    loginStatus.textContent = '';
    loginStatus.className = 'status-message';
    
    showNotification('Disconnected from session', 'success');
  }

  function confirmEndSession() {
    showConfirmDialog(
      'End Session',
      'Are you sure you want to end the session for all participants? This action cannot be undone.',
      () => endSession()
    );
  }

  // FIX #3: Updated endSession function
  function endSession() {
    const activeRecorder = state.recorders.find(r => r.websocket && r.websocket.readyState === WebSocket.OPEN);
    
    if (activeRecorder) {
      try {
        const disconnectRequest = {
          type: 'disconnect',
          end: true
        };
        
        activeRecorder.websocket.send(JSON.stringify(disconnectRequest));
        console.log('Session end command sent via active recorder');
        
        state.recorders.forEach(recorder => {
          if (recorder.websocket && recorder.websocket.readyState === WebSocket.OPEN) {
            try {
              recorder.websocket.close(1000, "Session ended");
            } catch (e) {
              console.error(`Error closing websocket for ${recorder.id}:`, e);
            }
          }
        });
        
        showNotification('Session ended for all participants', 'info');
        disconnectFromSession();
      } catch (error) {
        console.error('Error ending session:', error);
        showNotification('Failed to end session. Please try again.', 'error');
      }
    } else {
      console.log('No active recorder, creating temporary connection to end session');
      
      if (!state.sessionId || !state.passcode) {
        showNotification('Cannot end session: Missing session credentials', 'error');
        return;
      }
      
      try {
        const tempWebSocket = new WebSocket('wss://dev-endpoint.wordly.ai/present');
        
        tempWebSocket.onopen = () => {
          console.log('Temporary WebSocket opened for ending session');
          
          const connectRequest = {
            type: 'connect',
            presentationCode: state.sessionId,
            accessKey: state.passcode,
            languageCode: 'en',
            speakerId: 'temp-end-session',
            name: 'Session Controller',
            connectionCode: 'wordly-join-app'
          };
          
          tempWebSocket.send(JSON.stringify(connectRequest));
        };
        
        tempWebSocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'status' && message.success) {
              console.log('Temporary connection established, sending end command');
              
              const disconnectRequest = {
                type: 'disconnect',
                end: true
              };
              
              tempWebSocket.send(JSON.stringify(disconnectRequest));
              
              setTimeout(() => {
                tempWebSocket.close(1000, "Session ended");
                showNotification('Session ended for all participants', 'info');
                disconnectFromSession();
              }, 500);
              
            } else if (message.type === 'status' && !message.success) {
              console.error('Failed to establish temporary connection:', message.message);
              tempWebSocket.close();
              showNotification(`Failed to end session: ${message.message || 'Connection error'}`, 'error');
            }
          } catch (error) {
            console.error('Error processing temporary connection message:', error);
            tempWebSocket.close();
            showNotification('Failed to end session: Communication error', 'error');
          }
        };
        
        tempWebSocket.onerror = (error) => {
          console.error('Temporary WebSocket error:', error);
          showNotification('Failed to end session: Connection error', 'error');
        };
        
        tempWebSocket.onclose = (event) => {
          console.log(`Temporary WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
        };
        
      } catch (error) {
        console.error('Error creating temporary WebSocket:', error);
        showNotification('Failed to end session: Could not establish connection', 'error');
      }
    }
  }
  
  // --- Recorder Management ---
  function addNewRecorder(config = {}) {
    const recorderId = `recorder-${Date.now()}`;
    
    const defaultConfig = {
      name: `Speaker ${state.recorders.length + 1}`,
      language: 'en',
      deviceId: '',
      muted: false,
      collapsed: false,
      connected: false
    };
    
    const recorderConfig = { ...defaultConfig, ...config };
    
    if (recorderConfig.deviceId && !state.inputDevices.find(d => d.deviceId === recorderConfig.deviceId)) {
      console.warn(`Device ID ${recorderConfig.deviceId} not found, using system default.`);
      recorderConfig.deviceId = '';
    }
    
    const recorderEl = document.createElement('div');
    recorderEl.className = 'recorder';
    recorderEl.id = recorderId;
    
    const deviceName = getDeviceName(recorderConfig.deviceId);
    const languageName = getLanguageName(recorderConfig.language);
    
    recorderEl.innerHTML = `
      <div class="recorder-header">
        <div class="recorder-title">
          <span class="recorder-status-light disconnected"></span>
          <span class="recorder-name">${recorderConfig.name}</span>
          <span class="recorder-language-indicator">${languageName}</span>
        </div>
        <div class="recorder-controls">
          <button class="recorder-btn mute-btn" data-action="mute">Mute</button>
          <button class="recorder-btn collapse-btn" data-action="toggle">Collapse</button>
          <button class="recorder-btn leave-btn" data-action="leave">Join</button>
          <button class="recorder-btn remove-btn" data-action="remove">Remove</button>
        </div>
      </div>
      <div class="recorder-settings">
        <div class="setting-group">
          <span class="setting-label">Name:</span>
          <input type="text" class="setting-input name-input" value="${recorderConfig.name}">
        </div>
        <div class="setting-group">
          <span class="setting-label">Language:</span>
          <select class="setting-select language-select"></select>
        </div>
        <div class="setting-group">
          <span class="setting-label">Device:</span>
          <select class="setting-select device-select"></select>
        </div>
      </div>
      <div class="recorder-content ${recorderConfig.collapsed ? 'collapsed' : ''}">
        <div class="audio-visualizer">
          <div class="audio-level"></div>
          <canvas class="visualizer-canvas"></canvas>
        </div>
        <div class="recorder-transcript"></div>
        <div class="recorder-status disconnected">Disconnected</div>
        <div class="audio-status">Audio ready</div>
      </div>
    `;
    
    recorderGrid.appendChild(recorderEl);
    
    const nameInput = recorderEl.querySelector('.name-input');
    
    const languageSelect = recorderEl.querySelector('.language-select');
    populateLanguageSelect(languageSelect, recorderConfig.language);
    
    const deviceSelect = recorderEl.querySelector('.device-select');
    populateDeviceSelect(deviceSelect, recorderConfig.deviceId);
    
    const recorderInstance = {
      id: recorderId,
      element: recorderEl,
      name: recorderConfig.name,
      language: recorderConfig.language,
      deviceId: recorderConfig.deviceId,
      muted: recorderConfig.muted,
      collapsed: recorderConfig.collapsed,
      websocket: null,
      status: 'disconnected',
      mediaStream: null,
      audioContext: null,
      audioSource: null,
      audioProcessor: null,
      audioAnalyser: null,
      audioLevel: 0,
      context: null,
      visualizerCanvas: recorderEl.querySelector('.visualizer-canvas'),
      visualizerContext: recorderEl.querySelector('.visualizer-canvas').getContext('2d'),
      audioLevelElement: recorderEl.querySelector('.audio-level')
    };
    
    state.recorders.push(recorderInstance);
    addRecorderEventListeners(recorderEl, recorderInstance);
    
    if (recorderConfig.connected) {
      connectRecorderWebSocket(recorderInstance);
    }
    
    setupVisualizer(recorderInstance);
    updateJoinButtonState(recorderInstance);

    return recorderInstance;
  }

  function removeRecorder(recorder) {
    console.log(`Removing recorder ${recorder.id}`);
    
    stopRecording(recorder);
    
    if (recorder.websocket && recorder.websocket.readyState !== WebSocket.CLOSED) {
      try {
        leaveRecorder(recorder, false);
      } catch (e) { 
        console.error(`Error leaving session for ${recorder.id}:`, e);
      }
    }
    
    recorder.element.remove();
    
    const index = state.recorders.findIndex(r => r.id === recorder.id);
    if (index !== -1) {
      state.recorders.splice(index, 1);
    }
    
    showNotification('Recorder removed', 'success');
  }

  function getRecorderById(recorderId) {
    return state.recorders.find(recorder => recorder.id === recorderId) || null;
  }

  function setupVisualizer(recorder) {
    if (!recorder.visualizerCanvas || !recorder.visualizerContext) {
      return;
    }
    
    const container = recorder.visualizerCanvas.parentElement;
    recorder.visualizerCanvas.width = container.clientWidth;
    recorder.visualizerCanvas.height = container.clientHeight;
    
    const ctx = recorder.visualizerContext;
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, recorder.visualizerCanvas.width, recorder.visualizerCanvas.height);
  }
  
  function updateVisualizer(recorder, audioLevel) {
    if (recorder.audioLevelElement) {
      const barCount = Math.round(audioLevel * 6);
      
      recorder.audioLevelElement.innerHTML = '';
      recorder.audioLevelElement.style.width = '100%';
      recorder.audioLevelElement.style.background = 'transparent';
      recorder.audioLevelElement.style.display = 'flex';
      recorder.audioLevelElement.style.alignItems = 'center';
      recorder.audioLevelElement.style.gap = '2px';
      recorder.audioLevelElement.style.padding = '4px';
      
      for (let i = 0; i < 6; i++) {
        const bar = document.createElement('div');
        bar.style.flex = '1';
        bar.style.height = '100%';
        bar.style.borderRadius = '2px';
        bar.style.transition = 'background-color 0.1s ease';
        
        const isLit = i < barCount;
        
        if (recorder.muted) {
          bar.style.backgroundColor = isLit ? '#e74c3c' : '#f8d7da';
        } else if (barCount >= 5) {
          bar.style.backgroundColor = isLit ? '#3498db' : '#ecf0f1';
        } else {
          bar.style.backgroundColor = isLit ? '#2ecc71' : '#ecf0f1';
        }
        
        recorder.audioLevelElement.appendChild(bar);
      }
      
      recorder.audioLevelElement.classList.remove('speaking', 'muted');
      
      if (recorder.muted) {
        recorder.audioLevelElement.classList.add('muted');
      } else if (barCount >= 5) {
        recorder.audioLevelElement.classList.add('speaking');
      }
    }
  }
  
  function startRecording(recorder) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      updateRecorderStatus(recorder, 'error', 'Browser does not support audio recording');
      return;
    }
    
    stopRecording(recorder, false);
    
    const constraints = {
      audio: {
        deviceId: recorder.deviceId ? { exact: recorder.deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 16000,
        channelCount: 1
      },
      video: false
    };
    
    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        recorder.mediaStream = stream;
        
        const audioContext = new AudioContext({
          latencyHint: 'interactive',
          sampleRate: 16000
        });
        
        const source = audioContext.createMediaStreamSource(stream);
        
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.3;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 1.5;
        
        const bufferSize = 2048;
        const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        
        source.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(processor);
        processor.connect(audioContext.destination);
        
        const targetSampleRate = state.sampleRate;
        const outputBufferSize = 1600;
        let outputBuffer = new Float32Array(outputBufferSize);
        let outputBufferIndex = 0;
        
        let lowEnergyCount = 0;
        let recentlySentAudio = false;
        
        processor.onaudioprocess = (e) => {
          analyser.getByteFrequencyData(dataArray);
          const average = getAverageAudioLevel(dataArray);
          const rawLevel = (average / 255) * 2.5;
          
          const adjustedLevel = rawLevel > 0.05 ? rawLevel : 0;
          
          const barCount = Math.min(6, Math.floor(adjustedLevel * 6));
          recorder.audioLevel = barCount / 6;
          
          updateVisualizer(recorder, recorder.audioLevel);
          
          if (recorder.websocket && 
              recorder.websocket.readyState === WebSocket.OPEN && 
              !recorder.muted) {
            const inputBuffer = e.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);
            
            for (let i = 0; i < inputData.length; i++) {
              if (outputBufferIndex < outputBufferSize) {
                outputBuffer[outputBufferIndex++] = inputData[i];
                
                if (outputBufferIndex >= outputBufferSize) {
                  const rmsLevel = getRMSLevel(outputBuffer);
                  const hasAudio = rmsLevel > 0.001;
                  
                  if (hasAudio) {
                    lowEnergyCount = 0;
                    recentlySentAudio = true;
                    
                    const pcmData = convertFloat32ToInt16(outputBuffer, 1.5);
                    try {
                      recorder.websocket.send(pcmData);
                    } catch (error) {
                      console.error(`Error sending audio data for ${recorder.id}:`, error);
                    }
                  } else {
                    lowEnergyCount++;
                    
                    if (lowEnergyCount === 2 && recentlySentAudio) {
                      const silenceBuffer = new Float32Array(outputBufferSize);
                      const silencePcmData = convertFloat32ToInt16(silenceBuffer, 1.5);
                      
                      try {
                        recorder.websocket.send(silencePcmData);
                        recentlySentAudio = false;
                      } catch (error) {
                        console.error(`Error sending silence signal for ${recorder.id}:`, error);
                      }
                    }
                  }
                  
                  outputBufferIndex = 0;
                }
              }
            }
          }
        };
        
        recorder.audioContext = audioContext;
        recorder.audioSource = source;
        recorder.audioProcessor = processor;
        recorder.audioAnalyser = analyser;
        recorder.audioGain = gainNode;
        recorder.isRecording = true;
        
        updateRecorderStatus(recorder, recorder.status, 'Audio recording started');
        const audioStatusEl = recorder.element.querySelector('.audio-status');
        if (audioStatusEl) {
          audioStatusEl.textContent = recorder.muted ? 'Audio muted' : 'Audio recording active (16kHz direct)';
        }
        
        if (recorder.visualizerInterval) {
          clearInterval(recorder.visualizerInterval);
        }
        
        recorder.visualizerInterval = setInterval(() => {
          if (recorder.audioAnalyser) {
            analyser.getByteFrequencyData(dataArray);
            const average = getAverageAudioLevel(dataArray);
            recorder.audioLevel = Math.min(1, (average / 255) * 0.6);
            updateVisualizer(recorder, recorder.audioLevel);
          }
        }, 50);
      })
      .catch(error => {
        console.error(`Error starting audio recording for ${recorder.id}:`, error);
        updateRecorderStatus(recorder, 'error', `Recording error: ${error.message}`);
        addSystemMessage(recorder, `Error starting audio recording: ${error.message}`, true);
      });
  }

  function getRMSLevel(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }
  
  function getAverageAudioLevel(dataArray) {
    const len = dataArray.length;
    let sum = 0;
    let weight = 0;
    
    for (let i = 0; i < len; i++) {
      const frequency = (i / len) * 22050;
      
      let frequencyWeight = 0.5;
      
      if (frequency > 300 && frequency < 3000) {
        frequencyWeight = 3.0;
      }
      
      sum += dataArray[i] * frequencyWeight;
      weight += frequencyWeight;
    }
    
    return sum / weight;
  }
  
  function convertFloat32ToInt16(float32Array, gainFactor = 1.0) {
    const len = float32Array.length;
    const int16Array = new Int16Array(len);
    
    for (let i = 0; i < len; i++) {
      const amplifiedSample = float32Array[i] * gainFactor;
      const s = Math.max(-1, Math.min(1, amplifiedSample));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    return int16Array.buffer;
  }
  
  function stopRecording(recorder, stopVisualization = true) {
    if (!stopVisualization && recorder.mediaStream) {
      if (recorder.audioProcessor) {
        recorder.audioProcessor.disconnect();
        recorder.audioProcessor = null;
      }
      
      recorder.isRecording = false;
      
      const audioStatusEl = recorder.element.querySelector('.audio-status');
      if (audioStatusEl) {
        audioStatusEl.textContent = 'Audio recording stopped (visualization active)';
      }
      
      return;
    }
    
    if (recorder.visualizerInterval) {
      clearInterval(recorder.visualizerInterval);
      recorder.visualizerInterval = null;
    }
    
    if (recorder.mediaStream) {
      recorder.mediaStream.getTracks().forEach(track => track.stop());
      recorder.mediaStream = null;
    }
    
    if (recorder.audioProcessor) {
      recorder.audioProcessor.disconnect();
      recorder.audioProcessor = null;
    }
    
    if (recorder.audioGain) {
      recorder.audioGain.disconnect();
      recorder.audioGain = null;
    }
    
    if (recorder.audioAnalyser) {
      recorder.audioAnalyser.disconnect();
      recorder.audioAnalyser = null;
    }
    
    if (recorder.audioSource) {
      recorder.audioSource.disconnect();
      recorder.audioSource = null;
    }
    
    if (recorder.audioContext) {
      recorder.audioContext.close().catch(e => console.error('Error closing audio context:', e));
      recorder.audioContext = null;
    }
    
    recorder.audioLevel = 0;
    updateVisualizer(recorder, 0);
    recorder.isRecording = false;
    
    const audioStatusEl = recorder.element.querySelector('.audio-status');
    if (audioStatusEl) {
      audioStatusEl.textContent = 'Audio recording stopped';
    }
  }
  
  function toggleRecorderMute(recorder) {
    recorder.muted = !recorder.muted;
    
    const muteBtn = recorder.element.querySelector('.mute-btn');
    if (muteBtn) {
      muteBtn.textContent = recorder.muted ? 'Unmute' : 'Mute';
      muteBtn.classList.toggle('muted', recorder.muted);
    }
    
    const audioStatusEl = recorder.element.querySelector('.audio-status');
    if (audioStatusEl) {
      audioStatusEl.textContent = recorder.muted ? 'Audio muted' : 'Audio recording active';
    }
    
    const statusLight = recorder.element.querySelector('.recorder-status-light');
    if (statusLight) {
      if (recorder.muted) {
        statusLight.classList.remove('connected');
        statusLight.classList.add('muted');
      } else {
        statusLight.classList.remove('muted');
        if (recorder.status === 'connected') {
          statusLight.classList.add('connected');
        }
      }
    }
    
    addSystemMessage(recorder, recorder.muted ? 'Audio muted' : 'Audio unmuted');
  }
  
  function toggleMasterMute() {
    state.allMuted = !state.allMuted;
    
    masterMuteBtn.textContent = state.allMuted ? 'Unmute All' : 'Mute All';
    masterMuteBtn.classList.toggle('muted', state.allMuted);
    
    state.recorders.forEach(recorder => {
      if (recorder.muted !== state.allMuted) {
        recorder.muted = state.allMuted;
        
        const muteBtn = recorder.element.querySelector('.mute-btn');
        if (muteBtn) {
          muteBtn.textContent = state.allMuted ? 'Unmute' : 'Mute';
          muteBtn.classList.toggle('muted', state.allMuted);
        }
        
        const audioStatusEl = recorder.element.querySelector('.audio-status');
        if (audioStatusEl) {
          audioStatusEl.textContent = state.allMuted ? 'Audio muted' : 'Audio recording active';
        }
        
        const statusLight = recorder.element.querySelector('.recorder-status-light');
        if (statusLight) {
          if (state.allMuted) {
            statusLight.classList.remove('connected');
            statusLight.classList.add('muted');
          } else {
            statusLight.classList.remove('muted');
            if (recorder.status === 'connected') {
              statusLight.classList.add('connected');
            }
          }
        }
      }
    });
    
    showNotification(state.allMuted ? 'All recorders muted' : 'All recorders unmuted', 'info');
  }

  // --- WebSocket Handling ---
  // FIX #2: Updated connectRecorderWebSocket function
  function connectRecorderWebSocket(recorder) {
    if (!state.sessionId || !state.passcode) {
      updateRecorderStatus(recorder, 'error', 'Missing Session ID or Passcode');
      return;
    }
    
    if (recorder.status === 'connecting') {
      console.log(`Already connecting recorder ${recorder.id}. Ignoring duplicate request.`);
      showNotification('Connection already in progress', 'info');
      return;
    }
    
    if (recorder.websocket && recorder.websocket.readyState !== WebSocket.CLOSED) {
      console.log(`WebSocket for recorder ${recorder.id} already open.`);
      showNotification('Already connected', 'info');
      return;
    }
    
    // FIX #2: Always get the latest name from input field
    const nameInput = recorder.element.querySelector('.name-input');
    if (nameInput) {
      const currentName = nameInput.value.trim();
      if (currentName) {
        recorder.name = currentName;
        const nameDisplay = recorder.element.querySelector('.recorder-name');
        if (nameDisplay) {
          nameDisplay.textContent = recorder.name;
        }
      }
    }
    
    // FIX #2: Clear any stale context
    recorder.context = null;
    
    recorder.status = 'connecting';
    updateRecorderStatus(recorder, 'connecting');
    addSystemMessage(recorder, 'Connecting to session...');
    
    const leaveBtn = recorder.element.querySelector('.leave-btn');
    if (leaveBtn) {
      leaveBtn.textContent = 'Cancel';
    }
    
    try {
      if (recorder.connectionTimeout) {
        clearTimeout(recorder.connectionTimeout);
      }
      
      recorder.connectionTimeout = setTimeout(() => {
        if (recorder.status === 'connecting') {
          console.log(`Connection timeout for recorder ${recorder.id}`);
          if (recorder.websocket) {
            try {
              recorder.websocket.close(1000, "Connection timeout");
            } catch (e) {
              console.error(`Error closing WebSocket on timeout:`, e);
            }
            recorder.websocket = null;
          }
          recorder.status = 'disconnected';
          updateRecorderStatus(recorder, 'error', 'Connection timed out');
          addSystemMessage(recorder, 'Connection timed out. Please try again.', true);
          
          const leaveBtn = recorder.element.querySelector('.leave-btn');
          if (leaveBtn) {
            leaveBtn.textContent = 'Join';
          }
        }
      }, 10000);
      
      console.log(`Creating new WebSocket for recorder ${recorder.id}`);
      recorder.websocket = new WebSocket('wss://dev-endpoint.wordly.ai/present');
      
      recorder.websocket.onopen = () => {
        console.log(`WebSocket connection established for recorder ${recorder.id}`);
        
        const connectRequest = {
          type: 'connect',
          presentationCode: state.sessionId,
          accessKey: state.passcode,
          languageCode: recorder.language,
          speakerId: recorder.id,
          name: recorder.name,
          context: recorder.context || null,
          connectionCode: 'wordly-join-app'
        };
        
        try {
          recorder.websocket.send(JSON.stringify(connectRequest));
          console.log(`Connect request sent for recorder ${recorder.id} with name: ${recorder.name}`);
        } catch (error) {
          console.error(`Error sending connect request for recorder ${recorder.id}:`, error);
          updateRecorderStatus(recorder, 'error', 'Connection error');
          
          if (recorder.websocket) {
            try {
              recorder.websocket.close(1011, "Failed to send connect request");
            } catch (e) {
              console.error(`Error closing WebSocket:`, e);
            }
            recorder.websocket = null;
          }
          
          if (recorder.connectionTimeout) {
            clearTimeout(recorder.connectionTimeout);
            recorder.connectionTimeout = null;
          }
          
          const leaveBtn = recorder.element.querySelector('.leave-btn');
          if (leaveBtn) {
            leaveBtn.textContent = 'Join';
          }
          
          recorder.status = 'error';
        }
      };
      
      recorder.websocket.onmessage = (event) => {
        if (recorder.connectionTimeout) {
          clearTimeout(recorder.connectionTimeout);
          recorder.connectionTimeout = null;
        }
        
        try {
          const message = JSON.parse(event.data);
          console.log(`Received message type: ${message.type} for recorder ${recorder.id}`);
          
          switch (message.type) {
            case 'status': 
              handleStatusMessage(recorder, message); 
              break;
            case 'result': 
              handleResultMessage(recorder, message); 
              break;
            case 'end': 
              handleEndMessage(recorder); 
              break;
            case 'error': 
              handleErrorMessage(recorder, message); 
              break;
            case 'echo': 
              console.log(`Echo received for recorder ${recorder.id}`); 
              break;
            default: 
              console.warn(`Unhandled message type: ${message.type} for recorder ${recorder.id}`);
          }
        } catch (error) {
          console.error(`Error processing message for recorder ${recorder.id}:`, error, event.data);
        }
      };
      
      recorder.websocket.onclose = (event) => {
        if (recorder.connectionTimeout) {
          clearTimeout(recorder.connectionTimeout);
          recorder.connectionTimeout = null;
        }
        
        state.recorders.forEach(r => {
          updateJoinButtonState(r);
        });
        
        console.log(`WebSocket closed for recorder ${recorder.id}. Code: ${event.code}, Reason: ${event.reason}, Was Clean: ${event.wasClean}`);
        
        stopRecording(recorder);
        
        if (recorder.status !== 'error') {
          const status = event.wasClean || event.code === 1000 ? 'disconnected' : 'error';
          const message = status === 'disconnected' ? 'Disconnected' : `Connection lost (Code: ${event.code})`;
          
          recorder.status = status;
          updateRecorderStatus(recorder, status, message);
          addSystemMessage(recorder, `Disconnected from session: ${event.reason || 'Session closed'}`, status === 'error');
        }
        
        const leaveBtn = recorder.element.querySelector('.leave-btn');
        if (leaveBtn) {
          leaveBtn.textContent = 'Join';
        }
        
        recorder.websocket = null;
      };
      
      recorder.websocket.onerror = (error) => {
        if (recorder.connectionTimeout) {
          clearTimeout(recorder.connectionTimeout);
          recorder.connectionTimeout = null;
        }
        
        console.error(`WebSocket error for recorder ${recorder.id}:`, error);
        
        stopRecording(recorder);
        
        recorder.status = 'error';
        updateRecorderStatus(recorder, 'error', 'Connection error');
        addSystemMessage(recorder, 'WebSocket error occurred', true);
        
        if (recorder.websocket && recorder.websocket.readyState !== WebSocket.CLOSED) {
          try {
            recorder.websocket.close(1011, "WebSocket error");
          } catch (e) {
            console.error(`Error closing WebSocket after error:`, e);
          }
        }
        
        const leaveBtn = recorder.element.querySelector('.leave-btn');
        if (leaveBtn) {
          leaveBtn.textContent = 'Join';
        }
        
        recorder.websocket = null;
      };
    } catch (error) {
      if (recorder.connectionTimeout) {
        clearTimeout(recorder.connectionTimeout);
        recorder.connectionTimeout = null;
      }
      
      console.error(`Error creating WebSocket for recorder ${recorder.id}:`, error);
      recorder.status = 'error';
      updateRecorderStatus(recorder, 'error', 'Connection error');
      
      const leaveBtn = recorder.element.querySelector('.leave-btn');
      if (leaveBtn) {
        leaveBtn.textContent = 'Join';
      }
    }
  }
  
  // --- Message Handling Logic ---
  function handleStatusMessage(recorder, message) {
    console.log(`Status message for recorder ${recorder.id}:`, message);
    
    if (recorder.connectionTimeout) {
      clearTimeout(recorder.connectionTimeout);
      recorder.connectionTimeout = null;
    }
    
    if (message.success) {
      recorder.status = 'connected';
      updateRecorderStatus(recorder, 'connected', 'Connected');
      addSystemMessage(recorder, 'Connected to session');
      
      const leaveBtn = recorder.element.querySelector('.leave-btn');
      if (leaveBtn) {
        leaveBtn.textContent = 'Leave';
      }
      
      if (message.reservedUntil) {
        const reservationDate = new Date(message.reservedUntil);
        const formattedTime = reservationDate.toLocaleTimeString();
        addSystemMessage(recorder, `Session reserved until ${formattedTime}`);
      }
      
      if (recorder.websocket && recorder.websocket.readyState === WebSocket.OPEN) {
        if (!recorder.startRequestSent) {
          recorder.startRequestSent = true;
          sendStartRequest(recorder);
        }
      }
    } else {
      recorder.status = 'error';
      updateRecorderStatus(recorder, 'error', message.message || 'Connection failed');
      addSystemMessage(recorder, `Connection error: ${message.message || 'Unknown error'}`, true);
      
      const leaveBtn = recorder.element.querySelector('.leave-btn');
      if (leaveBtn) {
        leaveBtn.textContent = 'Join';
      }
      
      if (recorder.websocket && recorder.websocket.readyState !== WebSocket.CLOSED) {
        try {
          recorder.websocket.close(1000, "Connection failed");
        } catch (e) {
          console.error(`Error closing WebSocket after connection failure:`, e);
        }
        recorder.websocket = null;
      }
    }
  }
  
  function handleResultMessage(recorder, message) {
    if (message.context) {
      recorder.context = message.context;
    }
    
    const transcriptContainer = recorder.element.querySelector('.recorder-transcript');
    
    if (transcriptContainer) {
      let resultElement = transcriptContainer.querySelector(`#result-${message.phraseId}`);
      
      if (!resultElement) {
        resultElement = document.createElement('div');
        resultElement.id = `result-${message.phraseId}`;
        resultElement.className = 'phrase';
        resultElement.innerHTML = `
          <div class="phrase-header">
            <span class="speaker-name">${recorder.name}</span>
            <span class="phrase-time">${new Date().toLocaleTimeString()}</span>
          </div>
          <div class="phrase-text"></div>
        `;
        transcriptContainer.insertBefore(resultElement, transcriptContainer.firstChild);
        limitTranscriptSize(transcriptContainer);
      }
      
      const textElement = resultElement.querySelector('.phrase-text');
      if (textElement) {
        textElement.textContent = message.text;
        resultElement.classList.toggle('final', message.final);
      }
    }
  }
  
  function handleEndMessage(recorder) {
    updateRecorderStatus(recorder, 'ended', 'Session ended');
    addSystemMessage(recorder, 'The presentation has ended.');
    
    stopRecording(recorder);
    
    if (recorder.websocket && recorder.websocket.readyState === WebSocket.OPEN) {
      try {
        recorder.websocket.close(1000, "Presentation ended");
      } catch (e) {
        console.error(`Error closing WebSocket for ${recorder.id}:`, e);
      }
    }
    
    const leaveBtn = recorder.element.querySelector('.leave-btn');
    if (leaveBtn) {
      leaveBtn.textContent = 'Join';
    }
    
    recorder.websocket = null;
  }
  
  function handleErrorMessage(recorder, message) {
    updateRecorderStatus(recorder, 'error', message.message || 'Unknown error');
    addSystemMessage(recorder, `Error: ${message.message || 'Unknown error'}`, true);
  }
  
  function sendStartRequest(recorder) {
    if (!recorder.websocket || recorder.websocket.readyState !== WebSocket.OPEN) {
      console.warn(`Cannot send start request for ${recorder.id}: WebSocket not open`);
      return;
    }
    
    if (recorder.audioProcessingStarted) {
      console.log(`Audio processing already started for recorder ${recorder.id}`);
      return;
    }
    
    const startRequest = {
      type: 'start',
      languageCode: recorder.language,
      sampleRate: state.sampleRate
    };
    
    try {
      recorder.websocket.send(JSON.stringify(startRequest));
      console.log(`Start request sent for recorder ${recorder.id}`);
      
      recorder.audioProcessingStarted = true;
      startRecording(recorder);
    } catch (error) {
      console.error(`Error sending start request for recorder ${recorder.id}:`, error);
      addSystemMessage(recorder, `Error starting audio: ${error.message}`, true);
      recorder.audioProcessingStarted = false;
    }
  }
  
  function sendStopRequest(recorder) {
    if (!recorder.websocket || recorder.websocket.readyState !== WebSocket.OPEN) {
      console.warn(`Cannot send stop request for ${recorder.id}: WebSocket not open`);
      return;
    }
    
    const stopRequest = {
      type: 'stop'
    };
    
    try {
      recorder.websocket.send(JSON.stringify(stopRequest));
      console.log(`Stop request sent for recorder ${recorder.id}`);
      stopRecording(recorder);
    } catch (error) {
      console.error(`Error sending stop request for recorder ${recorder.id}:`, error);
    }
  }
  
  function leaveRecorder(recorder, notify = true) {
    console.log(`Attempting to leave session for recorder ${recorder.id}`);
    
    recorder.startRequestSent = false;
    recorder.audioProcessingStarted = false;
    
    if (!recorder.websocket || recorder.websocket.readyState !== WebSocket.OPEN) {
      console.warn(`Cannot leave session for ${recorder.id}: WebSocket not open`);
      
      recorder.status = 'disconnected';
      updateRecorderStatus(recorder, 'disconnected', 'Disconnected');
      
      const leaveBtn = recorder.element.querySelector('.leave-btn');
      if (leaveBtn) {
        leaveBtn.textContent = 'Join';
      }
      
      if (notify) {
        showNotification('Not connected to session', 'info');
      }
      return;
    }
    
    const disconnectRequest = {
      type: 'disconnect',
      end: false
    };
    
    try {
      stopRecording(recorder, false);
      
      recorder.status = 'disconnected';
      updateRecorderStatus(recorder, 'disconnected', 'Disconnected');
      
      recorder.websocket.send(JSON.stringify(disconnectRequest));
      console.log(`Leave request sent for recorder ${recorder.id}`);
      
      recorder.websocket.close(1000, "Left session");
      recorder.websocket = null;
      
      addSystemMessage(recorder, 'Left the session');
      
      const leaveBtn = recorder.element.querySelector('.leave-btn');
      if (leaveBtn) {
        leaveBtn.textContent = 'Join';
      }
      
      if (notify) {
        showNotification('Left the session', 'info');
      }
    } catch (error) {
      console.error(`Error leaving session for recorder ${recorder.id}:`, error);
      
      recorder.status = 'disconnected';
      updateRecorderStatus(recorder, 'disconnected', 'Disconnected');
      
      const leaveBtn = recorder.element.querySelector('.leave-btn');
      if (leaveBtn) {
        leaveBtn.textContent = 'Join';
      }
      
      if (notify) {
        showNotification('Error leaving session', 'error');
      }
    }
  }
  
  // --- UI Updates and Event Handling ---
  function updateRecorderStatus(recorder, status, message) {
    recorder.status = status;
    
    const statusLight = recorder.element.querySelector('.recorder-status-light');
    const statusEl = recorder.element.querySelector('.recorder-status');
    
    if (statusLight) {
      statusLight.className = `recorder-status-light ${status}`;
      
      if (recorder.muted) {
        statusLight.classList.add('muted');
      }
    }
    
    if (statusEl) {
      statusEl.className = `recorder-status ${status}`;
      statusEl.textContent = message || status.charAt(0).toUpperCase() + status.slice(1);
    }
  }
  
  function addSystemMessage(recorder, message, isError = false) {
    const transcriptContainer = recorder.element.querySelector('.recorder-transcript');
    if (!transcriptContainer) return;
    
    const messageEl = document.createElement('div');
    messageEl.className = isError ? 'phrase system-message error' : 'phrase system-message';
    messageEl.textContent = message;
    
    transcriptContainer.insertBefore(messageEl, transcriptContainer.firstChild);
    limitTranscriptSize(transcriptContainer);
  }
  
  function limitTranscriptSize(transcriptContainer, maxPhrases = 50) {
    while (transcriptContainer.children.length > maxPhrases) {
      transcriptContainer.removeChild(transcriptContainer.lastChild);
    }
  }
  
  function populateLanguageSelect(selectElement, selectedLanguage) {
    selectElement.innerHTML = '';
    
    Object.entries(languageMap).forEach(([code, name]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = name;
      selectElement.appendChild(option);
    });
    
    selectElement.value = selectedLanguage;
  }
  
  function populateDeviceSelect(selectElement, selectedDeviceId) {
    selectElement.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'System Default Microphone';
    selectElement.appendChild(defaultOption);
    
    state.inputDevices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Microphone ${device.deviceId.slice(0, 6)}...`;
      selectElement.appendChild(option);
    });
    
    if (selectedDeviceId && state.inputDevices.find(d => d.deviceId === selectedDeviceId)) {
      selectElement.value = selectedDeviceId;
    } else {
      selectElement.value = '';
    }
  }
  
  function getDeviceName(deviceId) {
    if (!deviceId) return 'System Default Microphone';
    const device = state.inputDevices.find(d => d.deviceId === deviceId);
    return device?.label || `Microphone ${deviceId.slice(0, 6)}...` || 'Unknown Device';
  }
  
  function getLanguageName(code) {
    return languageMap[code] || code;
  }
  
  function addRecorderEventListeners(recorderEl, recorder) {
    if (!recorder) {
      console.error("Attempted to add listeners to non-existent recorder for element:", recorderEl);
      return;
    }
    
    const nameInput = recorderEl.querySelector('.name-input');
    nameInput.addEventListener('change', (e) => {
      recorder.name = e.target.value.trim() || `Speaker ${state.recorders.indexOf(recorder) + 1}`;
      recorderEl.querySelector('.recorder-name').textContent = recorder.name;
    });
    
    const languageSelect = recorderEl.querySelector('.language-select');
    languageSelect.addEventListener('change', (e) => {
      const newLanguage = e.target.value;
      if (newLanguage === recorder.language) return;
      
      recorder.language = newLanguage;
      const languageName = getLanguageName(newLanguage);
      recorderEl.querySelector('.recorder-language-indicator').textContent = languageName;
      
      if (recorder.websocket && recorder.websocket.readyState === WebSocket.OPEN) {
        sendStopRequest(recorder);
        sendStartRequest(recorder);
        addSystemMessage(recorder, `Language changed to ${languageName}.`);
      }
    });
    
    const deviceSelect = recorderEl.querySelector('.device-select');
    deviceSelect.addEventListener('change', (e) => {
      const oldDeviceId = recorder.deviceId;
      recorder.deviceId = e.target.value;
      
      const deviceName = getDeviceName(recorder.deviceId);
      
      addSystemMessage(recorder, `Input device changed to: ${deviceName}`);
      
      if (recorder.mediaStream) {
        stopRecording(recorder);
        if (recorder.websocket && recorder.websocket.readyState === WebSocket.OPEN) {
          startRecording(recorder);
        }
      }
      
      updateJoinButtonState(recorder);
    });
    
    recorderEl.querySelector('.recorder-controls').addEventListener('click', (e) => {
      if (e.target.matches('.mute-btn')) {
        toggleRecorderMute(recorder);
      } else if (e.target.matches('.collapse-btn')) {
        toggleRecorderCollapse(recorder);
      } else if (e.target.matches('.leave-btn')) {
        if (e.target.disabled) {
          showNotification('This device is already in use by another recorder', 'error');
          return;
        }
        
        if (recorder.websocket && recorder.websocket.readyState === WebSocket.OPEN) {
          leaveRecorder(recorder, true);
        } else if (recorder.status !== 'connecting') {
          connectRecorderWebSocket(recorder);
        } else {
          showNotification('Connection already in progress', 'info');
        }
      } else if (e.target.matches('.remove-btn')) {
        if (confirm(`Are you sure you want to remove the recorder for ${recorder.name}?`)) {
          removeRecorder(recorder);
        }
      }
    });
  }
  
  function toggleRecorderCollapse(recorder) {
    recorder.collapsed = !recorder.collapsed;
    
    const contentEl = recorder.element.querySelector('.recorder-content');
    const collapseBtn = recorder.element.querySelector('.collapse-btn');
    
    if (!contentEl || !collapseBtn) {
      console.error(`Recorder ${recorder.id}: Could not find content or collapse button elements.`);
      return;
    }
    
    contentEl.classList.toggle('collapsed', recorder.collapsed);
    collapseBtn.textContent = recorder.collapsed ? 'Expand' : 'Collapse';
  }
  
  function toggleAllRecorders() {
    state.allCollapsed = !state.allCollapsed;
    
    state.recorders.forEach(recorder => {
      if (recorder.collapsed !== state.allCollapsed) {
        toggleRecorderCollapse(recorder);
      }
    });
    
    globalCollapseBtn.textContent = state.allCollapsed ? 'Expand All' : 'Collapse All';
  }
  
  // --- Presets (LocalStorage) ---
  function loadPresetsFromStorage() {
    try {
      const savedPresets = localStorage.getItem('wordlyJoinPresets');
      if (savedPresets) {
        state.presets = JSON.parse(savedPresets);
        updatePresetDropdown();
      }
    } catch (error) {
      console.error('Error loading presets:', error);
      localStorage.removeItem('wordlyJoinPresets');
    }
  }
  
  function updatePresetDropdown() {
    const placeholder = presetSelect.options[0];
    presetSelect.innerHTML = '';
    presetSelect.appendChild(placeholder);
    
    Object.keys(state.presets).sort().forEach(presetName => {
      const option = document.createElement('option');
      option.value = presetName;
      option.textContent = presetName;
      presetSelect.appendChild(option);
    });
  }
  
  function savePreset() {
    const presetName = presetNameInput.value.trim();
    if (!presetName) {
      showNotification('Please enter a name for the preset', 'error');
      return;
    }
    
    if (!state.sessionId) {
      showNotification('Cannot save preset, not connected to a session.', 'error');
      return;
    }
    
    const presetConfig = {
      recorders: state.recorders.map(r => ({
        name: r.name,
        language: r.language,
        deviceId: r.deviceId,
        muted: r.muted,
        collapsed: r.collapsed
      }))
    };
    
    state.presets[presetName] = presetConfig;
    
    try {
      localStorage.setItem('wordlyJoinPresets', JSON.stringify(state.presets));
      updatePresetDropdown();
      showNotification(`Preset "${presetName}" saved`, 'success');
      presetNameInput.value = '';
      presetSelect.value = presetName;
    } catch (error) {
      console.error('Error saving preset:', error);
      showNotification('Error saving preset. Storage might be full.', 'error');
    }
  }
  
  function loadSelectedPreset() {
    const presetName = presetSelect.value;
    if (!presetName) {
      showNotification('Please select a preset to load', 'error');
      return;
    }
    
    const preset = state.presets[presetName];
    if (!preset) {
      showNotification(`Preset "${presetName}" not found`, 'error');
      return;
    }
    
    if (!state.sessionId) {
      showNotification('Connect to a session before loading a preset layout.', 'error');
      return;
    }
    
    console.log(`Loading preset "${presetName}"`);
    
    const presetRecorderConfigs = preset.recorders || [];
    
    state.recorders.forEach(r => {
      stopRecording(r);
      leaveRecorder(r, false);
    });
    
    recorderGrid.innerHTML = '';
    state.recorders = [];
    
    if (presetRecorderConfigs.length > 0) {
      presetRecorderConfigs.forEach(recorderConfig => {
        const recorder = addNewRecorder(recorderConfig);
        if (recorderConfig.connected !== false) {
          connectRecorderWebSocket(recorder);
        }
      });
      
      showNotification(`Loaded preset "${presetName}"`, 'success');
    } else {
      showNotification(`Preset "${presetName}" loaded (no recorders defined)`, 'info');
    }
  }
  
  function deleteSelectedPreset() {
    const presetName = presetSelect.value;
    if (!presetName) {
      showNotification('Please select a preset to delete', 'error');
      return;
    }
    
    if (confirm(`Are you sure you want to delete the preset "${presetName}"?`)) {
      delete state.presets[presetName];
      
      try {
        localStorage.setItem('wordlyJoinPresets', JSON.stringify(state.presets));
        updatePresetDropdown();
        presetSelect.value = '';
        showNotification(`Preset "${presetName}" deleted`, 'success');
      } catch (error) {
        console.error('Error deleting preset:', error);
        showNotification('Error deleting preset', 'error');
      }
    }
  }
  
  // --- Notifications and Dialogs ---
  function showNotification(message, type = 'success') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    const notificationDuration = 3000;
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 500);
    }, notificationDuration - 500);
  }
  
  function showConfirmDialog(title, message, onConfirm) {
    const existingOverlay = document.querySelector('.modal-overlay');
    if (existingOverlay) existingOverlay.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    
    dialog.innerHTML = `
      <h3 class="modal-title">${title}</h3>
      <div class="modal-body">${message}</div>
      <div class="modal-actions">
        <button class="btn-cancel">Cancel</button>
        <button class="btn-confirm">Confirm</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    dialog.querySelector('.btn-cancel').addEventListener('click', () => {
      overlay.remove();
    });
    
    dialog.querySelector('.btn-confirm').addEventListener('click', () => {
      overlay.remove();
      if (typeof onConfirm === 'function') {
        onConfirm();
      }
    });
  }
  
  // Dual-join prevention functions
  function isDeviceInUse(deviceId) {
    const isDefaultDevice = !deviceId || deviceId === 'default' || deviceId === '';
    
    return state.recorders.some(recorder => {
      const recorderUsingDefault = !recorder.deviceId || recorder.deviceId === 'default' || recorder.deviceId === '';
      const usingSameDevice = isDefaultDevice ? recorderUsingDefault : (recorder.deviceId === deviceId);
      
      return usingSameDevice && 
             recorder.status === 'connected' &&
             recorder.websocket && 
             recorder.websocket.readyState === WebSocket.OPEN;
    });
  }

  function updateJoinButtonState(recorder) {
    if (!recorder || !recorder.element) return;
    
    const leaveBtn = recorder.element.querySelector('.leave-btn');
    const deviceSelect = recorder.element.querySelector('.device-select');
    
    if (!leaveBtn || !deviceSelect) return;
    
    if (recorder.status !== 'connected' && recorder.status !== 'connecting') {
      const deviceId = deviceSelect.value;
      const isInUse = isDeviceInUse(deviceId);
      
      if (isInUse) {
        leaveBtn.disabled = true;
        leaveBtn.textContent = 'Device In Use';
        leaveBtn.classList.add('disabled');
      } else {
        leaveBtn.disabled = false;
        leaveBtn.textContent = 'Join';
        leaveBtn.classList.remove('disabled');
      }
    }
  }

}); // End of DOMContentLoaded event listener          
