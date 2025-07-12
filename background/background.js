// Background service worker for Article Reader Pro
class ArticleReaderBackground {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupContextMenu();
        this.setupOffscreenDocument();
    }

    setupEventListeners() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                this.handleInstall();
            }
        });

        // Handle messages from content scripts and popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Handle tab updates to inject content scripts
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                this.injectContentScript(tabId);
            }
        });

        // Handle keyboard shortcuts
        chrome.commands.onCommand.addListener((command) => {
            this.handleCommand(command);
        });
    }

    setupContextMenu() {
        chrome.contextMenus.create({
            id: 'read-article',
            title: 'Read Article Aloud',
            contexts: ['page']
        });

        chrome.contextMenus.create({
            id: 'summarize-article',
            title: 'Summarize Article',
            contexts: ['page']
        });

        chrome.contextMenus.create({
            id: 'translate-article',
            title: 'Translate Article',
            contexts: ['page']
        });

        chrome.contextMenus.onClicked.addListener((info, tab) => {
            this.handleContextMenuClick(info, tab);
        });
    }

    async setupOffscreenDocument() {
        // Create offscreen document for advanced audio processing
        try {
            await chrome.offscreen.createDocument({
                url: 'offscreen/offscreen.html',
                reasons: ['AUDIO_PLAYBACK'],
                justification: 'Audio playback for text-to-speech functionality'
            });
        } catch (error) {
            console.log('Offscreen document already exists or not needed');
        }
    }

    handleInstall() {
        // Set default settings
        chrome.storage.sync.set({
            theme: 'light',
            language: 'en',
            voice: '',
            speed: 1.0,
            fontSize: 16,
            autoPlay: false,
            highlightText: true,
            smartDetection: true
        });

        // Initialize storage
        chrome.storage.local.set({
            history: [],
            bookmarks: [],
            notes: {},
            offlineArticles: [],
            preferences: {}
        });

        // Open welcome page
        chrome.tabs.create({
            url: 'welcome/welcome.html'
        });
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'extractArticle':
                    const article = await this.extractArticle(sender.tab);
                    sendResponse({ success: true, article });
                    break;

                case 'generateSummary':
                    const summary = await this.generateSummary(request.text, request.type);
                    sendResponse({ success: true, summary });
                    break;

                case 'translateText':
                    const translation = await this.translateText(request.text, request.targetLanguage);
                    sendResponse({ success: true, translation });
                    break;

                case 'extractKeywords':
                    const keywords = await this.extractKeywords(request.text);
                    sendResponse({ success: true, keywords });
                    break;

                case 'findRelated':
                    const related = await this.findRelatedArticles(request.text, request.url);
                    sendResponse({ success: true, related });
                    break;

                case 'saveToHistory':
                    await this.saveToHistory(request.article);
                    sendResponse({ success: true });
                    break;

                case 'getVoices':
                    const voices = await this.getAvailableVoices();
                    sendResponse({ success: true, voices });
                    break;

                case 'playAudio':
                    await this.playAudio(request.text, request.settings);
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async handleCommand(command) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        switch (command) {
            case 'toggle-reading':
                chrome.tabs.sendMessage(activeTab.id, { action: 'toggleReading' });
                break;
            case 'toggle-pause':
                chrome.tabs.sendMessage(activeTab.id, { action: 'togglePause' });
                break;
            case 'increase-speed':
                chrome.tabs.sendMessage(activeTab.id, { action: 'increaseSpeed' });
                break;
            case 'decrease-speed':
                chrome.tabs.sendMessage(activeTab.id, { action: 'decreaseSpeed' });
                break;
        }
    }

    async handleContextMenuClick(info, tab) {
        switch (info.menuItemId) {
            case 'read-article':
                chrome.tabs.sendMessage(tab.id, { action: 'readArticle' });
                break;
            case 'summarize-article':
                chrome.tabs.sendMessage(tab.id, { action: 'summarizeArticle' });
                break;
            case 'translate-article':
                chrome.tabs.sendMessage(tab.id, { action: 'translateArticle' });
                break;
        }
    }

    async injectContentScript(tabId) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['utils/textExtractor.js', 'utils/speechSynthesis.js', 'content/content.js']
            });
        } catch (error) {
            console.log('Content script injection failed:', error);
        }
    }

    async extractArticle(tab) {
        // Use Readability-like algorithm to extract main content
        const [result] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
                return window.ArticleExtractor ? window.ArticleExtractor.extract() : null;
            }
        });

        return result.result;
    }

    async generateSummary(text, type = 'quick') {
        // Mock AI summarization - in production, this would call an actual AI service
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        switch (type) {
            case 'quick':
                return this.generateQuickSummary(sentences);
            case 'detailed':
                return this.generateDetailedSummary(sentences);
            case 'takeaways':
                return this.generateTakeaways(sentences);
            default:
                return this.generateQuickSummary(sentences);
        }
    }

    generateQuickSummary(sentences) {
        // Simple extractive summarization
        const summaryLength = Math.max(2, Math.floor(sentences.length * 0.2));
        const topSentences = sentences
            .slice(0, summaryLength)
            .join('. ') + '.';
        
        return topSentences;
    }

    generateDetailedSummary(sentences) {
        const summaryLength = Math.max(5, Math.floor(sentences.length * 0.4));
        const topSentences = sentences
            .slice(0, summaryLength)
            .join('. ') + '.';
        
        return topSentences;
    }

    generateTakeaways(sentences) {
        const takeaways = sentences
            .slice(0, 5)
            .map((sentence, index) => `• ${sentence.trim()}`)
            .join('\n');
        
        return takeaways;
    }

    async translateText(text, targetLanguage) {
        // Mock translation - in production, this would use Google Translate API or similar
        return `[Translated to ${targetLanguage}] ${text.substring(0, 200)}...`;
    }

    async extractKeywords(text) {
        // Simple keyword extraction
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3);
        
        const wordFreq = {};
        words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });
        
        const sortedWords = Object.entries(wordFreq)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([word]) => word);
        
        return sortedWords;
    }

    async findRelatedArticles(text, url) {
        // Mock related articles finder
        return [
            { title: 'Related Article 1', url: 'https://example.com/1' },
            { title: 'Related Article 2', url: 'https://example.com/2' },
            { title: 'Related Article 3', url: 'https://example.com/3' }
        ];
    }

    async saveToHistory(article) {
        const { history = [] } = await chrome.storage.local.get(['history']);
        
        const historyItem = {
            ...article,
            timestamp: Date.now(),
            id: Date.now().toString()
        };
        
        history.unshift(historyItem);
        
        // Keep only last 100 items
        if (history.length > 100) {
            history.splice(100);
        }
        
        await chrome.storage.local.set({ history });
    }

    async getAvailableVoices() {
        // This would typically be handled by the content script
        // Return mock voices for now
        return [
            { name: 'Default', lang: 'en-US' },
            { name: 'Female Voice', lang: 'en-US' },
            { name: 'Male Voice', lang: 'en-US' }
        ];
    }

    async playAudio(text, settings) {
        // Send to offscreen document for audio processing
        try {
            await chrome.runtime.sendMessage({
                action: 'playAudio',
                text,
                settings
            });
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    }
}

// Initialize background service
new ArticleReaderBackground();