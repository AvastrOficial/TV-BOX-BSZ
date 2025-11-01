  // Elementos del DOM
        const channelList = document.getElementById('channelList');
        const videoPlayer = document.getElementById('videoPlayer');
        const currentChannel = document.getElementById('currentChannel');
        const currentDescription = document.getElementById('currentDescription');
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const muteBtn = document.getElementById('muteBtn');
        const volumeSlider = document.getElementById('volumeSlider');
        const m3uUrlInput = document.getElementById('m3uUrl');
        const loadM3uBtn = document.getElementById('loadM3u');
        const statusMessage = document.getElementById('statusMessage');
        const searchInput = document.getElementById('searchInput');
        const channelCount = document.getElementById('channelCount');
        const filterButtons = document.querySelectorAll('.filter-btn');
        const sourceButtons = document.querySelectorAll('.source-btn');
        const m3uSection = document.getElementById('m3uSection');
        const preloadedSection = document.getElementById('preloadedSection');
        const mexicoSection = document.getElementById('mexicoSection');
        const premiumSection = document.getElementById('premiumSection');
        const preloadedLists = document.querySelectorAll('.preloaded-list');

        let currentVideo = null;
        let currentHls = null;
        let channels = [];
        let filteredChannels = [];
        let currentFilter = 'all';
        let searchTerm = '';
        let currentSource = 'demo';
        let channelTimeouts = new Map();

        // Canales de demostración con imágenes reales
        const demoChannels = [
            {
                id: 1,
                name: "Hollywood Review TV",
                description: "Canal de entretenimiento - Las mejores series y programas",
                logo: "https://i.imgur.com/HSdwqZN.png",
                group: "Entretenimiento",
                url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                status: "demo",
                type: "mp4"
            }
        ];

        // Función para cargar archivo M3U
        async function loadM3U(url, listName = "Lista M3U") {
            try {
                showStatus(`Cargando ${listName}...`, "info");
                
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status}`);
                }
                
                const m3uContent = await response.text();
                const parsedChannels = parseM3U(m3uContent);
                
                if (parsedChannels.length === 0) {
                    throw new Error("No se encontraron canales en el archivo M3U");
                }
                
                // Combinar con canales demo y marcar como custom
                channels = [...demoChannels, ...parsedChannels.map(ch => ({...ch, status: "waiting", source: 'custom'})).slice(0, 50)];
                
                showStatus(`${listName} cargada: ${parsedChannels.length} canales + ${demoChannels.length} canales demo`, "success");
                
                // Iniciar verificación de estado de canales
                checkChannelsStatus();
                applyFilters();
                
            } catch (error) {
                console.error("Error al cargar el archivo M3U:", error);
                showStatus(`Error: ${error.message}. Mostrando canales demo.`, "error");
                // En caso de error, cargar solo canales demo
                loadDemoChannels();
            }
        }

        // Función para cargar listas premium
        async function loadPremiumChannels(url, listName = "Lista Premium") {
            try {
                showStatus(`Cargando ${listName}...`, "info");
                
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status}`);
                }
                
                const m3uContent = await response.text();
                const parsedChannels = parseM3U(m3uContent);
                
                if (parsedChannels.length === 0) {
                    throw new Error("No se encontraron canales en la lista premium");
                }
                
                // Combinar con canales demo y marcar como premium
                channels = [...demoChannels, ...parsedChannels.map(ch => ({...ch, status: "waiting", source: 'premium'})).slice(0, 100)];
                
                showStatus(`${listName} cargada: ${parsedChannels.length} canales + ${demoChannels.length} canales demo`, "success");
                
                // Iniciar verificación de estado de canales
                checkChannelsStatus();
                applyFilters();
                
            } catch (error) {
                console.error("Error al cargar la lista premium:", error);
                showStatus(`Error: ${error.message}. Mostrando canales demo.`, "error");
                // En caso de error, cargar solo canales demo
                loadDemoChannels();
            }
        }

        // Cargar canales de demostración
        function loadDemoChannels() {
            channels = [...demoChannels];
            showStatus(`Cargados ${channels.length} canales de demostración`, "success");
            applyFilters();
        }

        // Cargar canales de México
        async function loadMexicoChannels() {
            try {
                showStatus("Cargando canales de México...", "info");
                
                const response = await fetch('https://raw.githubusercontent.com/CharlieII/IPTV_mexico/refs/heads/main/lista.m3u');
                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status}`);
                }
                
                const m3uContent = await response.text();
                const parsedChannels = parseM3U(m3uContent);
                
                if (parsedChannels.length === 0) {
                    throw new Error("No se encontraron canales en la lista de México");
                }
                
                // Combinar con canales demo y marcar como mexico
                channels = [...demoChannels, ...parsedChannels.map(ch => ({...ch, status: "waiting", source: 'mexico'})).slice(0, 60)];
                
                showStatus(`TV México cargada: ${parsedChannels.length} canales + ${demoChannels.length} canales demo`, "success");
                
                // Iniciar verificación de estado de canales
                checkChannelsStatus();
                applyFilters();
                
            } catch (error) {
                console.error("Error al cargar canales de México:", error);
                showStatus(`Error: ${error.message}. Mostrando canales demo.`, "error");
                loadDemoChannels();
            }
        }

        // Verificar estado de todos los canales
        async function checkChannelsStatus() {
            showStatus("Verificando estado de canales...", "info");
            
            for (let channel of channels) {
                if (channel.status === "demo") continue; // Los demo siempre funcionan
                
                await checkSingleChannelStatus(channel);
                // Pequeña pausa entre verificaciones para no sobrecargar
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            showStatus("Verificación de canales completada", "success");
            applyFilters();
        }

        // Verificar estado de un canal individual
        async function checkSingleChannelStatus(channel) {
            return new Promise((resolve) => {
                const videoElement = document.createElement('video');
                videoElement.muted = true;
                videoElement.preload = 'auto';
                
                let timeout1s, timeout3s;
                let loaded = false;
                
                // Timeout de 1 segundo - canal desechado
                timeout1s = setTimeout(() => {
                    if (!loaded) {
                        channel.status = "waiting";
                        console.log(`Canal ${channel.name} en lista de espera (1s)`);
                    }
                }, 1000);
                
                // Timeout de 3 segundos - fuera de servicio
                timeout3s = setTimeout(() => {
                    if (!loaded) {
                        channel.status = "offline";
                        console.log(`Canal ${channel.name} fuera de servicio (3s)`);
                        videoElement.src = '';
                        resolve();
                    }
                }, 3000);
                
                // Evento cuando el canal carga
                const onLoaded = () => {
                    if (!loaded) {
                        loaded = true;
                        clearTimeout(timeout1s);
                        clearTimeout(timeout3s);
                        channel.status = "live";
                        console.log(`Canal ${channel.name} agregado (cargó después de ${Date.now() - startTime}ms)`);
                        videoElement.src = '';
                        resolve();
                    }
                };
                
                const startTime = Date.now();
                
                try {
                    if (channel.url.includes('.m3u8') && Hls.isSupported()) {
                        const hls = new Hls({
                            enableWorker: false,
                            lowLatencyMode: true,
                            maxBufferLength: 5
                        });
                        
                        hls.loadSource(channel.url);
                        hls.attachMedia(videoElement);
                        
                        hls.on(Hls.Events.MANIFEST_PARSED, onLoaded);
                        hls.on(Hls.Events.ERROR, () => {
                            if (!loaded) {
                                channel.status = "offline";
                                resolve();
                            }
                        });
                    } else {
                        videoElement.src = channel.url;
                        videoElement.addEventListener('loadeddata', onLoaded);
                        videoElement.addEventListener('error', () => {
                            if (!loaded) {
                                channel.status = "offline";
                                resolve();
                            }
                        });
                    }
                } catch (error) {
                    console.error(`Error verificando canal ${channel.name}:`, error);
                    channel.status = "offline";
                    resolve();
                }
            });
        }

        // Función para parsear contenido M3U
        function parseM3U(content) {
            const lines = content.split('\n');
            const channels = [];
            let currentChannel = {};
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                if (line.startsWith('#EXTINF:')) {
                    // Extraer información del canal
                    const info = line.substring(8);
                    const commaIndex = info.indexOf(',');
                    
                    if (commaIndex !== -1) {
                        const attributes = info.substring(0, commaIndex);
                        const name = info.substring(commaIndex + 1);
                        
                        // Extraer atributos
                        const tvgIdMatch = attributes.match(/tvg-id="([^"]*)"/);
                        const tvgNameMatch = attributes.match(/tvg-name="([^"]*)"/);
                        const tvgLogoMatch = attributes.match(/tvg-logo="([^"]*)"/);
                        const groupTitleMatch = attributes.match(/group-title="([^"]*)"/);
                        
                        currentChannel = {
                            id: channels.length + 1000, // IDs altos para diferenciar
                            name: name || 'Canal sin nombre',
                            logo: tvgLogoMatch ? tvgLogoMatch[1] : getDefaultLogo(),
                            group: groupTitleMatch ? groupTitleMatch[1] : 'General',
                            url: '',
                            status: "waiting",
                            source: 'custom'
                        };
                    }
                } else if (line && !line.startsWith('#') && currentChannel.name) {
                    // Esta línea es la URL del stream
                    currentChannel.url = line;
                    channels.push({...currentChannel});
                    currentChannel = {};
                }
            }
            
            return channels;
        }

        // Obtener logo por defecto basado en el grupo
        function getDefaultLogo() {
            const defaultLogos = {
                'Sports': 'https://i.imgur.com/mX7N4RE.png',
                'News': 'https://i.imgur.com/9zQ8b2J.png',
                'Entertainment': 'https://i.imgur.com/HSdwqZN.png',
                'Movies': 'https://i.imgur.com/KvL3W3n.png',
                'Kids': 'https://i.imgur.com/5tL8Q9c.png',
                'Documentary': 'https://i.imgur.com/3rM8b2D.png',
                'Mexico': 'https://i.imgur.com/2Q4kQ7a.png',
                'Animation': 'https://i.imgur.com/5tL8Q9c.png'
            };
            
            return 'https://i.imgur.com/HSdwqZN.png'; // Logo por defecto
        }

        // Aplicar filtros y búsqueda
        function applyFilters() {
            filteredChannels = channels.filter(channel => {
                // Filtrar por fuente si es necesario
                if (currentSource === 'demo' && channel.source !== 'demo') {
                    return false;
                }
                if (currentSource === 'mexico' && channel.source !== 'mexico') {
                    return false;
                }
                if (currentSource === 'premium' && channel.source !== 'premium') {
                    return false;
                }
                
                // Aplicar filtro seleccionado
                if (currentFilter === 'working' && channel.status !== 'demo' && channel.status !== 'live') {
                    return false;
                }
                if (currentFilter === 'waiting' && channel.status !== 'waiting') {
                    return false;
                }
                if (currentFilter === 'offline' && channel.status !== 'offline') {
                    return false;
                }
                if (currentFilter === 'sports' && !isSportsChannel(channel)) {
                    return false;
                }
                if (currentFilter === 'news' && !isNewsChannel(channel)) {
                    return false;
                }
                if (currentFilter === 'mexico' && !isMexicoChannel(channel)) {
                    return false;
                }
                if (currentFilter === 'animation' && !isAnimationChannel(channel)) {
                    return false;
                }
                
                // Aplicar búsqueda
                if (searchTerm && !channel.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                    return false;
                }
                
                return true;
            });
            
            updateChannelCount();
            loadChannels();
        }

        // Funciones de detección de categorías
        function isSportsChannel(channel) {
            const sportsKeywords = ['sport', 'deporte', 'futbol', 'football', 'fútbol', 'racing', 'tennis', 'basketball', 'baloncesto'];
            return sportsKeywords.some(keyword => 
                channel.name.toLowerCase().includes(keyword) || 
                channel.group.toLowerCase().includes(keyword)
            );
        }

        function isNewsChannel(channel) {
            const newsKeywords = ['news', 'noticia', 'noticiero', 'informe', 'cnn', 'bbc', 'fox news', 'noticias'];
            return newsKeywords.some(keyword => 
                channel.name.toLowerCase().includes(keyword) || 
                channel.group.toLowerCase().includes(keyword)
            );
        }

        function isMexicoChannel(channel) {
            const mexicoKeywords = ['mexico', 'méxico', 'mx', 'azteca', 'televisa', 'tv azteca'];
            return mexicoKeywords.some(keyword => 
                channel.name.toLowerCase().includes(keyword) || 
                channel.group.toLowerCase().includes(keyword) ||
                channel.source === 'mexico'
            );
        }

        function isAnimationChannel(channel) {
            const animationKeywords = ['cartoon', 'animación', 'dibujos', 'kids', 'niños', 'infantil', 'animation', 'anime'];
            return animationKeywords.some(keyword => 
                channel.name.toLowerCase().includes(keyword) || 
                channel.group.toLowerCase().includes(keyword)
            );
        }

        function isPremiumChannel(channel) {
            return channel.source === 'premium';
        }

        // Actualizar contador de canales
        function updateChannelCount() {
            const total = channels.length;
            const filtered = filteredChannels.length;
            const working = channels.filter(c => c.status === 'live' || c.status === 'demo').length;
            const waiting = channels.filter(c => c.status === 'waiting').length;
            const offline = channels.filter(c => c.status === 'offline').length;
            const mexico = channels.filter(c => isMexicoChannel(c)).length;
            const premium = channels.filter(c => isPremiumChannel(c)).length;
            const animation = channels.filter(c => isAnimationChannel(c)).length;
            
            if (currentFilter === 'all' && !searchTerm && currentSource === 'all') {
                channelCount.textContent = `${total} canales (${working} activos, ${waiting} en espera, ${offline} fuera servicio, ${mexico} mexicanos, ${premium} premium, ${animation} animación)`;
            } else {
                channelCount.textContent = `${filtered} de ${total} canales`;
            }
        }

        // Mostrar mensaje de estado
        function showStatus(message, type) {
            statusMessage.textContent = message;
            statusMessage.className = 'status-message ' + (type === 'success' ? 'success' : 
                                                          type === 'error' ? 'error' : 
                                                          type === 'warning' ? 'warning' : 'info');
            
            // Auto-ocultar mensajes después de 5 segundos
            setTimeout(() => {
                if (statusMessage.textContent === message) {
                    statusMessage.textContent = '';
                    statusMessage.className = 'status-message';
                }
            }, 5000);
        }

        // Cargar lista de canales en la interfaz
        function loadChannels() {
            channelList.innerHTML = '';
            
            if (filteredChannels.length === 0) {
                channelList.innerHTML = '<div class="no-video">No hay canales que coincidan con los filtros</div>';
                return;
            }
            
            // Ordenar: primero demo, luego live, luego waiting, luego offline
            const sortedChannels = [...filteredChannels].sort((a, b) => {
                const statusOrder = {demo: 0, live: 1, waiting: 2, offline: 3};
                return statusOrder[a.status] - statusOrder[b.status];
            });
            
            sortedChannels.forEach(channel => {
                const channelItem = document.createElement('div');
                channelItem.className = 'channel-item';
                
                let statusClass = '';
                let statusText = '';
                
                if (channel.status === 'live') {
                    statusClass = 'live';
                    statusText = 'EN VIVO';
                } else if (channel.status === 'demo') {
                    statusClass = 'demo';
                    statusText = 'DEMO';
                } else if (channel.status === 'waiting') {
                    statusClass = 'waiting';
                    statusText = 'EN ESPERA';
                } else if (channel.status === 'offline') {
                    statusClass = 'offline';
                    statusText = 'FUERA SERVICIO';
                }
                
                channelItem.innerHTML = `
                    <div class="channel-logo">
                        <img src="${channel.logo}" alt="${channel.name}" onerror="this.src='https://i.imgur.com/HSdwqZN.png'">
                    </div>
                    <div class="channel-info">
                        <div class="channel-name">${channel.name}</div>
                        <div class="channel-group">${channel.group}</div>
                    </div>
                    ${statusText ? `<div class="channel-status ${statusClass}">${statusText}</div>` : ''}
                `;
                
                channelItem.addEventListener('click', () => {
                    // Remover clase activa de todos los canales
                    document.querySelectorAll('.channel-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    
                    // Agregar clase activa al canal seleccionado
                    channelItem.classList.add('active');
                    
                    // Cargar el canal
                    loadChannel(channel);
                });
                
                channelList.appendChild(channelItem);
            });
        }

        // Cargar un canal específico
        function loadChannel(channel) {
            // Limpiar el reproductor
            videoPlayer.innerHTML = '';
            
            // Detener cualquier instancia HLS anterior
            if (currentHls) {
                currentHls.destroy();
                currentHls = null;
            }
            
            // Limpiar timeouts anteriores
            if (channelTimeouts.has(channel.id)) {
                clearTimeout(channelTimeouts.get(channel.id));
                channelTimeouts.delete(channel.id);
            }
            
            // Actualizar información del canal
            currentChannel.textContent = channel.name;
            currentDescription.textContent = channel.description || `Grupo: ${channel.group} | Estado: ${getStatusText(channel.status)}`;
            
            // Si el canal está offline, no intentar cargarlo
            if (channel.status === 'offline') {
                showStreamError(channel, "Este canal está fuera de servicio");
                return;
            }
            
            // Crear elemento de video
            const videoElement = document.createElement('video');
            videoElement.id = 'videoStream';
            videoElement.controls = true;
            videoElement.autoplay = true;
            videoElement.muted = false;
            
            // Mostrar mensaje de carga con imagen del canal
            videoPlayer.innerHTML = `
                <div class="no-video">
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                        <img src="${channel.logo}" alt="${channel.name}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover;" onerror="this.src='https://i.imgur.com/HSdwqZN.png'">
                        <div>
                            <h3 style="margin: 0; color: var(--highlight);">${channel.name}</h3>
                            <p style="margin: 5px 0 0 0; color: var(--text-secondary);">${channel.group}</p>
                        </div>
                    </div>
                    <p>Cargando transmisión...</p>
                    <div class="loading" style="margin: 20px auto;"></div>
                    <p style="font-size: 12px; margin-top: 10px;">Estado: ${getStatusText(channel.status)}</p>
                </div>
            `;
            
            // Configurar timeouts para este canal
            const timeout1s = setTimeout(() => {
                if (videoElement.readyState < 2) {
                    showStatus("Canal en lista de espera...", "warning");
                }
            }, 1000);
            
            const timeout3s = setTimeout(() => {
                if (videoElement.readyState < 2) {
                    showStreamError(channel, "El canal tarda demasiado en cargar - Fuera de servicio");
                    if (currentHls) {
                        currentHls.destroy();
                        currentHls = null;
                    }
                    channel.status = "offline";
                    applyFilters();
                }
            }, 3000);
            
            channelTimeouts.set(channel.id, timeout3s);
            
            // Intentar cargar el stream
            setTimeout(() => {
                try {
                    // Para HLS, usar la librería HLS.js si está disponible
                    if (channel.url.includes('.m3u8') && Hls.isSupported()) {
                        currentHls = new Hls({
                            enableWorker: false,
                            lowLatencyMode: true,
                            backBufferLength: 90,
                            debug: false,
                            maxBufferLength: 30
                        });
                        
                        currentHls.loadSource(channel.url);
                        currentHls.attachMedia(videoElement);
                        
                        currentHls.on(Hls.Events.MANIFEST_PARSED, function() {
                            clearTimeout(timeout1s);
                            clearTimeout(timeout3s);
                            channelTimeouts.delete(channel.id);
                            showVideoElement(videoElement, channel);
                            showStatus("Canal cargado correctamente", "success");
                            if (channel.status !== 'demo') {
                                channel.status = 'live';
                                applyFilters();
                            }
                        });
                        
                        currentHls.on(Hls.Events.ERROR, function(event, data) {
                            console.error("HLS Error:", data);
                            if (data.fatal) {
                                clearTimeout(timeout1s);
                                clearTimeout(timeout3s);
                                channelTimeouts.delete(channel.id);
                                showStreamError(channel, "Error en el stream HLS");
                                channel.status = "offline";
                                applyFilters();
                            }
                        });
                    } else if (channel.url.includes('.m3u8') && videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                        // Safari nativo soporta HLS
                        videoElement.src = channel.url;
                        videoElement.addEventListener('loadedmetadata', () => {
                            clearTimeout(timeout1s);
                            clearTimeout(timeout3s);
                            channelTimeouts.delete(channel.id);
                            showVideoElement(videoElement, channel);
                            showStatus("Canal cargado correctamente", "success");
                            if (channel.status !== 'demo') {
                                channel.status = 'live';
                                applyFilters();
                            }
                        });
                    } else {
                        // Para MP4 y otros formatos
                        videoElement.src = channel.url;
                        videoElement.addEventListener('loadeddata', () => {
                            clearTimeout(timeout1s);
                            clearTimeout(timeout3s);
                            channelTimeouts.delete(channel.id);
                            showVideoElement(videoElement, channel);
                            showStatus("Canal cargado correctamente", "success");
                            if (channel.status !== 'demo') {
                                channel.status = 'live';
                                applyFilters();
                            }
                        });
                    }
                    
                    // Manejar errores generales
                    videoElement.addEventListener('error', (e) => {
                        console.error("Video error:", e);
                        clearTimeout(timeout1s);
                        clearTimeout(timeout3s);
                        channelTimeouts.delete(channel.id);
                        showStreamError(channel, "No se pudo cargar el video");
                        channel.status = "offline";
                        applyFilters();
                    });
                    
                } catch (error) {
                    console.error("Error al cargar el canal:", error);
                    clearTimeout(timeout1s);
                    clearTimeout(timeout3s);
                    channelTimeouts.delete(channel.id);
                    showStreamError(channel, error.message);
                    channel.status = "offline";
                    applyFilters();
                }
            }, 500);
        }

        // Obtener texto del estado
        function getStatusText(status) {
            const statusMap = {
                'demo': 'Demo - Siempre funciona',
                'live': 'En vivo - Funcionando',
                'waiting': 'En espera - Cargando...',
                'offline': 'Fuera de servicio - No disponible'
            };
            return statusMap[status] || 'Estado desconocido';
        }

        // Mostrar el elemento de video cuando esté listo
        function showVideoElement(videoElement, channel) {
            videoPlayer.innerHTML = '';
            videoPlayer.appendChild(videoElement);
            currentVideo = videoElement;
            setupVideoControls();
            
            // Intentar reproducir automáticamente
            const playPromise = videoElement.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.log("No se pudo reproducir automáticamente:", e);
                    showStatus("Haz clic en play para iniciar el video", "info");
                });
            }
        }

        // Mostrar error de stream
        function showStreamError(channel, errorMsg) {
            videoPlayer.innerHTML = `
                <div class="no-video">
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                        <img src="${channel.logo}" alt="${channel.name}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover;" onerror="this.src='https://i.imgur.com/HSdwqZN.png'">
                        <div>
                            <h3 style="margin: 0; color: var(--highlight);">${channel.name}</h3>
                            <p style="margin: 5px 0 0 0; color: var(--text-secondary);">${channel.group}</p>
                        </div>
                    </div>
                    <h3>Error al cargar el canal</h3>
                    <p style="color: #f44336; margin-top: 10px;">${errorMsg}</p>
                    <p style="font-size: 12px; margin-top: 10px;">
                        Estado actual: ${getStatusText(channel.status)}
                    </p>
                    <p style="font-size: 12px; margin-top: 10px;">
                        Recomendación: Prueba con los canales marcados como "DEMO" o "EN VIVO"
                    </p>
                </div>
            `;
        }

        // Configurar controles de video
        function setupVideoControls() {
            if (!currentVideo) return;
            
            playBtn.onclick = () => {
                currentVideo.play().catch(e => {
                    console.log("Error al reproducir:", e);
                    showStatus("No se puede reproducir el video", "error");
                });
            };
            
            pauseBtn.onclick = () => currentVideo.pause();
            
            muteBtn.onclick = () => {
                currentVideo.muted = !currentVideo.muted;
                muteBtn.innerHTML = currentVideo.muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
            };
            
            volumeSlider.oninput = () => {
                currentVideo.volume = volumeSlider.value / 100;
            };
        }

        // Inicializar la aplicación
        function init() {
            // Configurar selectores de fuente
            sourceButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    sourceButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentSource = btn.dataset.source;
                    
                    // Mostrar/ocultar secciones apropiadas
                    m3uSection.style.display = currentSource === 'custom' ? 'flex' : 'none';
                    preloadedSection.style.display = currentSource === 'preloaded' ? 'block' : 'none';
                    mexicoSection.style.display = currentSource === 'mexico' ? 'block' : 'none';
                    premiumSection.style.display = currentSource === 'premium' ? 'block' : 'none';
                    
                    if (currentSource === 'demo') {
                        loadDemoChannels();
                    } else if (currentSource === 'preloaded') {
                        // Cargar la primera lista por defecto
                        const firstList = document.querySelector('#preloadedSection .preloaded-list.active');
                        if (firstList) {
                            const url = firstList.dataset.url;
                            const name = firstList.querySelector('.preloaded-list-name').textContent;
                            loadM3U(url, name);
                        }
                    } else if (currentSource === 'mexico') {
                        // Cargar la primera lista de México por defecto
                        const firstList = document.querySelector('#mexicoSection .preloaded-list.active');
                        if (firstList) {
                            const url = firstList.dataset.url;
                            const name = firstList.querySelector('.preloaded-list-name').textContent;
                            if (url.includes('mexico')) {
                                loadMexicoChannels();
                            } else {
                                loadM3U(url, name);
                            }
                        }
                    } else if (currentSource === 'premium') {
                        // Cargar la primera lista premium por defecto
                        const firstList = document.querySelector('#premiumSection .preloaded-list.active');
                        if (firstList) {
                            const url = firstList.dataset.url;
                            const name = firstList.querySelector('.preloaded-list-name').textContent;
                            loadPremiumChannels(url, name);
                        }
                    } else if (currentSource === 'custom') {
                        const url = m3uUrlInput.value.trim();
                        if (url) {
                            loadM3U(url);
                        }
                    }
                });
            });
            
            // Configurar listas pre-cargadas
            preloadedLists.forEach(list => {
                list.addEventListener('click', () => {
                    // Remover activo de todas las listas en la misma sección
                    const parentSection = list.closest('.preloaded-lists');
                    parentSection.querySelectorAll('.preloaded-list').forEach(l => l.classList.remove('active'));
                    
                    // Agregar activo a la lista clickeada
                    list.classList.add('active');
                    
                    if (currentSource === 'preloaded' && parentSection.id === 'preloadedSection') {
                        const url = list.dataset.url;
                        const name = list.querySelector('.preloaded-list-name').textContent;
                        loadM3U(url, name);
                    } else if (currentSource === 'mexico' && parentSection.id === 'mexicoSection') {
                        const url = list.dataset.url;
                        const name = list.querySelector('.preloaded-list-name').textContent;
                        if (url.includes('mexico')) {
                            loadMexicoChannels();
                        } else {
                            loadM3U(url, name);
                        }
                    } else if (currentSource === 'premium' && parentSection.id === 'premiumSection') {
                        const url = list.dataset.url;
                        const name = list.querySelector('.preloaded-list-name').textContent;
                        loadPremiumChannels(url, name);
                    }
                });
            });
            
            // Configurar evento para cargar M3U
            loadM3uBtn.addEventListener('click', () => {
                const url = m3uUrlInput.value.trim();
                if (url) {
                    loadM3U(url);
                }
            });
            
            // Configurar filtros
            filterButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    filterButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentFilter = btn.dataset.filter;
                    applyFilters();
                });
            });
            
            // Configurar búsqueda
            searchInput.addEventListener('input', (e) => {
                searchTerm = e.target.value.trim();
                applyFilters();
            });
            
            // Permitir búsqueda con Enter
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    applyFilters();
                }
            });
            
            // Cargar canales demo por defecto
            loadDemoChannels();
            
            // Mostrar información sobre HLS
            if (Hls.isSupported()) {
                console.log("HLS.js está soportado en este navegador");
            } else if (document.createElement('video').canPlayType('application/vnd.apple.mpegurl')) {
                console.log("HLS nativo está soportado en este navegador (Safari)");
            } else {
                console.log("HLS no está soportado en este navegador");
                showStatus("Advertencia: Algunos streams pueden no funcionar en este navegador", "warning");
            }
        }

        // Iniciar cuando el DOM esté listo
        document.addEventListener('DOMContentLoaded', init);
