// CarteScolaire.paris — Custom MapLibre controls

// Recenter control
class RecenterControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

        const button = document.createElement('button');
        button.className = 'maplibregl-ctrl-icon';
        button.type = 'button';
        button.title = 'Recentrer sur Paris';
        button.innerHTML = '<span class="glyphicon glyphicon-resize-full" style="font-size: 14px; line-height: 29px;"></span>';
        button.onclick = () => {
            const isMobile = window.innerWidth <= 768;
            map.fitBounds(isMobile ? parisBoundsMobile : parisBounds, { padding: 20 });
        };

        this._container.appendChild(button);
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

// Locate control
class LocateControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

        const button = document.createElement('button');
        button.className = 'maplibregl-ctrl-icon';
        button.type = 'button';
        button.title = 'Ma position';
        button.innerHTML = '<i class="fa fa-location-arrow" style="font-size: 14px; line-height: 29px;"></i>';
        button.onclick = () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lng = position.coords.longitude;
                        const lat = position.coords.latitude;

                        // Remove existing user location marker
                        if (userLocationMarker) {
                            userLocationMarker.remove();
                        }

                        // Create user location marker
                        const el = document.createElement('div');
                        el.className = 'user-location-marker';
                        el.style.width = '20px';
                        el.style.height = '20px';
                        el.style.borderRadius = '50%';
                        el.style.backgroundColor = '#4285F4';
                        el.style.border = '3px solid white';
                        el.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';

                        userLocationMarker = new maplibregl.Marker(el)
                            .setLngLat([lng, lat])
                            .addTo(map);

                        map.flyTo({
                            center: [lng, lat],
                            zoom: 17
                        });
                    },
                    (error) => {
                        alert('Impossible de récupérer votre position: ' + error.message);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 10000
                    }
                );
            } else {
                alert('La géolocalisation n\'est pas supportée par votre navigateur');
            }
        };

        this._container.appendChild(button);
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

// Layer panel control
class LayerControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

        const button = document.createElement('button');
        button.className = 'maplibregl-ctrl-icon';
        button.type = 'button';
        button.title = 'Couches';
        button.innerHTML = '<i class="fa fa-map" style="font-size: 14px; line-height: 29px;"></i>';

        const panel = document.createElement('div');
        panel.id = 'layer-panel';
        panel.style.display = 'none';
        panel.innerHTML = `
            <div class="layer-sheet-handle"></div>
            <button class="layer-sheet-close" aria-label="Fermer">&times;</button>
            <div class="layer-section-title">Collèges</div>
            <a href="#" id="colleges-btn" class="layer-item"><i class="fa fa-circle blue"></i>&nbsp; Collèges (marqueurs)</a>
            <a href="#" id="colleges-secto-btn" class="layer-item"><i class="fa fa-map-o"></i>&nbsp; Carte scolaire</a>
            <a href="#" id="colleges-txreu-btn" class="layer-item"><i class="fa fa-percent"></i>&nbsp; Taux de réussite au Brevet</a>
            <a href="#" id="colleges-txmention-btn" class="layer-item"><i class="fa fa-percent"></i>&nbsp; Taux de mention au Brevet</a>
            <div class="layer-divider"></div>
            <div class="layer-section-title">Lycées</div>
            <a href="#" id="lycees-eg-btn" class="layer-item"><i class="fa fa-circle red"></i>&nbsp; Enseignement général</a>
            <a href="#" id="lycees-tech-btn" class="layer-item"><i class="fa fa-circle green"></i>&nbsp; Enseignement technologique</a>
            <a href="#" id="lycees-eg-tech-btn" class="layer-item"><i class="fa fa-circle orange"></i>&nbsp; Gén. &amp; Technologique</a>
            <a href="#" id="lycees-poly-btn" class="layer-item"><i class="fa fa-circle violet"></i>&nbsp; Polyvalents</a>
            <a href="#" id="lycees-pro-btn" class="layer-item"><i class="fa fa-circle yellow"></i>&nbsp; Professionnels</a>
        `;

        const backdrop = document.createElement('div');
        backdrop.id = 'layer-panel-backdrop';
        document.body.appendChild(backdrop);
        this._backdrop = backdrop;

        const showPanel = () => {
            if (isMobile()) {
                panel.classList.add('open');
                backdrop.classList.add('open');
            } else {
                panel.style.display = 'block';
            }
        };

        const hidePanel = () => {
            if (isMobile()) {
                panel.classList.remove('open');
                backdrop.classList.remove('open');
            } else {
                panel.style.display = 'none';
            }
        };

        const isPanelOpen = () => isMobile()
            ? panel.classList.contains('open')
            : panel.style.display !== 'none';

        button.onclick = (e) => {
            e.stopPropagation();
            isPanelOpen() ? hidePanel() : showPanel();
        };

        backdrop.onclick = () => hidePanel();

        panel.querySelector('.layer-sheet-close').addEventListener('click', (e) => {
            e.preventDefault();
            hidePanel();
        });

        document.addEventListener('click', (e) => {
            if (!isMobile() && !this._container.contains(e.target) && !panel.contains(e.target)) {
                hidePanel();
            }
        });

        this._container.appendChild(button);
        map.getContainer().appendChild(panel);
        this._panel = panel;
        this._hidePanel = hidePanel;

        initMenuState();
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        if (this._panel && this._panel.parentNode) {
            this._panel.parentNode.removeChild(this._panel);
        }
        if (this._backdrop && this._backdrop.parentNode) {
            this._backdrop.parentNode.removeChild(this._backdrop);
        }
        this._map = undefined;
    }
}

// About modal control
class AboutControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

        const button = document.createElement('button');
        button.className = 'maplibregl-ctrl-icon';
        button.type = 'button';
        button.title = 'A propos';
        button.innerHTML = '<i class="fa fa-question-circle" style="font-size: 14px; line-height: 29px;"></i>';
        button.onclick = () => {
            $('#aboutModal').modal('show');
        };

        this._container.appendChild(button);
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}
