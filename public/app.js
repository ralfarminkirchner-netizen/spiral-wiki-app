// State
let wikiData = [];
let currentSearch = '';

// Elements
const appRoot = document.getElementById('app-root');

// Init
async function init() {
    try {
        wikiData = typeof windowWikiData !== 'undefined' ? windowWikiData : [];
        if (wikiData.length === 0) throw new Error('Data could not be loaded.');
        
        // Sort by title
        wikiData.sort((a, b) => a.title.localeCompare(b.title));

        // Handle simple routing
        handleRoute();
        window.addEventListener('hashchange', handleRoute);
    } catch (error) {
        appRoot.innerHTML = `<div class="reader-container not-found glass"><h2>Fehler beim Laden der Bibliothek</h2><p>${error.message}</p></div>`;
    }
}

// Router
function handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    
    if (hash.startsWith('/monograph/')) {
        const id = hash.replace('/monograph/', '');
        renderMonograph(id);
    } else {
        renderDashboard();
    }
    // Scroll to top
    window.scrollTo(0, 0);
}

// Render Dashboard
function buildTree(items) {
    const root = { _items: [], _subcats: {} };
    for (const item of items) {
        let current = root;
        for (const cat of item.category) {
            if (!current._subcats[cat]) {
                current._subcats[cat] = { _items: [], _subcats: {} };
            }
            current = current._subcats[cat];
        }
        current._items.push(item);
    }
    return root;
}

function renderTree(node, searchStr = '') {
    let html = '';
    
    const subcatNames = Object.keys(node._subcats).sort();
    for (const catName of subcatNames) {
        const subNode = node._subcats[catName];
        const hasSearch = searchStr.trim().length > 0;
        const isOpen = hasSearch ? 'open' : '';
        
        html += `
            <details class="category-details" ${isOpen}>
                <summary class="category-summary glass-panel">
                    <span class="folder-icon">▶</span>
                    <span class="category-name">${catName.replace(/_/g, ' ')}</span>
                </summary>
                <div class="category-content">
                    ${renderTree(subNode, searchStr)}
                </div>
            </details>
        `;
    }
    
    if (node._items.length > 0) {
        html += '<ul class="monograph-list nested-list">';
        const sortedItems = node._items.sort((a, b) => a.title.localeCompare(b.title));
        for (const item of sortedItems) {
            const imgHtml = item.imageUrl ? `<img src="${item.imageUrl}" class="monograph-thumb" alt="${item.title}">` : '';
            html += `
                <li>
                    <a href="#/monograph/${item.id}" class="monograph-link glass-link">
                        ${imgHtml}
                        <span>${item.title}</span>
                    </a>
                </li>
            `;
        }
        html += '</ul>';
    }
    
    return html;
}

function renderDashboard() {
    // Filter by search
    const searchStr = currentSearch.toLowerCase();
    const filteredData = wikiData.filter(d => 
        d.title.toLowerCase().includes(searchStr) || 
        d.category.join(' ').toLowerCase().includes(searchStr)
    );

    const tree = buildTree(filteredData);
    
    // Count main categories for stats
    const mainCategories = Object.keys(tree._subcats).length;

    let html = `
        <div class="dashboard-container animate-fade-in">
            <header class="hero">
                <h1 class="gradient-text">Totalbibliothek</h1>
                <p class="subtitle">Das kybernetische Lexikon des Spiral OS</p>
                <div class="search-bar">
                    <input 
                        type="text" 
                        id="searchInput"
                        placeholder="Suche nach Denkern oder Disziplinen..." 
                        value="${currentSearch}"
                    />
                </div>
            </header>

            <div class="stats-container">
                <div class="stat-box glass">
                    <h3>Einträge</h3>
                    <p class="stat-number">${filteredData.length} <span style="font-size: 0.8rem; opacity: 0.5">/ ${wikiData.length}</span></p>
                </div>
                <div class="stat-box glass">
                    <h3>Hauptkategorien</h3>
                    <p class="stat-number">${mainCategories}</p>
                </div>
            </div>

            <div class="category-tree-container">
                ${renderTree(tree, searchStr)}
            </div>
        </div>
    `;

    appRoot.innerHTML = html;

    // Add search event listener
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value;
            renderDashboard(); // Re-render on type
        });
    }
}

// Render Monograph Reader
function renderMonograph(id) {
    const monograph = wikiData.find(d => d.id === id);

    if (!monograph) {
        appRoot.innerHTML = `
            <div class="reader-wrapper animate-slide-up glass" style="padding: 3rem; text-align: center; margin-top: 4rem;">
                <h2>Monographie nicht gefunden</h2>
                <br>
                <a href="#/" class="btn-back" style="justify-content: center;"><span class="icon">←</span> Zurück zur Bibliothek</a>
            </div>
        `;
        return;
    }

    // Parse Markdown to HTML
    // Replace internal links like [Name](/monograph/id) to [Name](#/monograph/id)
    let rawMarkdown = monograph.content.replace(/\(\/monograph\//g, '(#/monograph/');
    
    // Parse
    const rawHtml = marked.parse(rawMarkdown);
    const cleanHtml = DOMPurify.sanitize(rawHtml);

    appRoot.innerHTML = `
        <div class="reader-wrapper animate-slide-up">
            <nav class="reader-nav glass">
                <a href="#/" class="btn-back">
                    <span class="icon">←</span> Zurück
                </a>
                <span class="category-badge">${monograph.category}</span>
            </nav>
            
            <article class="reader-content glass">
                ${cleanHtml}
            </article>
        </div>
    `;
}

// Start
init();
