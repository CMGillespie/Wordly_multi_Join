console.error(`Error sending stop request for recorder ${recorder.id}:`, error);
    }
  }
  
  function leaveRecorder(recorder, notify = true) {
    console.log(`Attempting to leave session for recorder ${recorder.id}`);
    
    // Reset connection flags
    recorder.startRequestSent = false;
    recorder.audioProcessingStarted = false;
    
    if (!recorder.websocket || recorder.websocket.readyState !== WebSocket.OPEN) {
      console.warn(`Cannot leave session for ${recorder.id}: WebSocket not open`);
      
      // Still update status even if not connected
      recorder.status = 'disconnected';
      updateRecorderStatus(recorder, 'disconnected', 'Disconnected');
      
      // Update leave button
      const leaveBtn = recorder.element.querySelector('.leave-btn');
      if (leaveBtn) {
        leaveBtn.textContent = 'Join';
      }
      
      if (notify) {
        showNotification('Not connected to session', 'info');
      }
      return;
    }
    
    // Send disconnect request with end=false to leave without ending the session
    const disconnectRequest = {
      type: 'disconnect',
      end: false
    };
    
    try {
      // Stop recording but keep visualization active
      stopRecording(recorder, false);
      
      // Update status before sending to prevent reconnection attempts
      recorder.status = 'disconnected';
      updateRecorderStatus(recorder, 'disconnected', 'Disconnected');
      
      // Send disconnect request
      recorder.websocket.send(JSON.stringify(disconnectRequest));
      console.log(`Leave request sent for recorder ${recorder.id}`);
      
      // Close the WebSocket
      recorder.websocket.close(1000, "Left session");
      recorder.websocket = null;
      
      // Add message
      addSystemMessage(recorder, 'Left the session');
      
      // Update leave button
      const leaveBtn = recorder.element.querySelector('.leave-btn');
      if (leaveBtn) {
        leaveBtn.textContent = 'Join';
      }
      
      if (notify) {
        showNotification('Left the session', 'info');
      }
    } catch (error) {
      console.error(`Error leaving session for recorder ${recorder.id}:`, error);
      
      // Make sure status is updated even if there's an error
      recorder.status = 'disconnected';
      updateRecorderStatus(recorder, 'disconnected', 'Disconnected');
      
      // Update leave button
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
      
      // If muted, override the status light
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
    selectElement.innerHTML = ''; // Clear existing
    
    Object.entries(languageMap).forEach(([code, name]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = name;
      selectElement.appendChild(option);
    });
    
    selectElement.value = selectedLanguage; // Set selected
  }
  
  function populateDeviceSelect(selectElement, selectedDeviceId) {
    selectElement.innerHTML = ''; // Clear existing
    
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
    
    // Ensure the selectedDeviceId still exists, otherwise revert to default
    if (selectedDeviceId && state.inputDevices.find(d => d.deviceId === selectedDeviceId)) {
      selectElement.value = selectedDeviceId;
    } else {
      selectElement.value = ''; // Default if ID not found
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
    
    // Name input change
    const nameInput = recorderEl.querySelector('.name-input');
    nameInput.addEventListener('change', (e) => {
      recorder.name = e.target.value.trim() || `Speaker ${state.recorders.indexOf(recorder) + 1}`;
      recorderEl.querySelector('.recorder-name').textContent = recorder.name;
    });
    
    // Language select change
    const languageSelect = recorderEl.querySelector('.language-select');
    languageSelect.addEventListener('change', (e) => {
      const newLanguage = e.target.value;
      if (newLanguage === recorder.language) return;
      
      recorder.language = newLanguage;
      const languageName = getLanguageName(newLanguage);
      recorderEl.querySelector('.recorder-language-indicator').textContent = languageName;
      
      // If connected, need to stop and restart with new language
      if (recorder.websocket && recorder.websocket.readyState === WebSocket.OPEN) {
        sendStopRequest(recorder);
        sendStartRequest(recorder);
        addSystemMessage(recorder, `Language changed to ${languageName}.`);
      }
    });
    
    // Device select change
    const deviceSelect = recorderEl.querySelector('.device-select');
    deviceSelect.addEventListener('change', (e) => {
      const oldDeviceId = recorder.deviceId;
      recorder.deviceId = e.target.value;
      
      const deviceName = getDeviceName(recorder.deviceId);
      
      addSystemMessage(recorder, `Input device changed to: ${deviceName}`);
      
      // If recording, restart with new device
      if (recorder.mediaStream) {
        stopRecording(recorder);
        if (recorder.websocket && recorder.websocket.readyState === WebSocket.OPEN) {
          startRecording(recorder);
        }
      }
      // ADD THIS LINE:
      updateJoinButtonState(recorder);
    });
    
    // Header buttons (Mute/Collapse/Leave/Remove)
    recorderEl.querySelector('.recorder-controls').addEventListener('click', (e) => {
      if (e.target.matches('.mute-btn')) {
        toggleRecorderMute(recorder);
      } else if (e.target.matches('.collapse-btn')) {
        toggleRecorderCollapse(recorder);
      } else if (e.target.matches('.leave-btn')) {
        // Check if button is disabled (device in use)
        if (e.target.disabled) {
          showNotification('This device is already in use by another recorder', 'error');
          return;
        }
        
        if (recorder.websocket && recorder.websocket.readyState === WebSocket.OPEN) {
          leaveRecorder(recorder, true);
        } else if (recorder.status !== 'connecting') {
          // Only allow new connection if we're not already connecting
          connectRecorderWebSocket(recorder);
        } else {
          // Already connecting, show notification
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
      localStorage.removeItem('wordlyJoinPresets'); // Clear potentially corrupt data
    }
  }
  
  function updatePresetDropdown() {
    // Clear previous options but keep the placeholder
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
      presetSelect.value = presetName; // Select the newly saved preset
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
    
    // Stop and remove all existing recorders cleanly
    state.recorders.forEach(r => {
      stopRecording(r);
      leaveRecorder(r, false);
    });
    
    recorderGrid.innerHTML = '';
    state.recorders = [];
    
    // Add recorders from the preset
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
        presetSelect.value = ''; // Reset selection
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
    // Remove any existing dialogs
    const existingOverlay = document.querySelector('.modal-overlay');
    if (existingOverlay) existingOverlay.remove();
    
    // Create new dialog
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
    
    // Add event listeners
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
