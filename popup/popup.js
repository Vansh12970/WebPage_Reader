class ArticleReaderPopup {
    constructor() {
        this.currentTab = null;
        this.isPlaying = false;
        this.currentPosition = 0;
        this.totalDuration = 0;
        this.articleText = '';
        this.voices = [];
        this.currentBookmark = null;
        
        this.init();
    }

    async init() {
        await this.getCurrentTab();
        this.setupEventListeners();
        this.loadVoices();
        this.loadSettings();
        this.updateStatus('Ready');
    }

    async getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        this.currentTab = tab;
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Article detection
        document.getElementById('detectArticle').addEventListener('click', () => {
            this.detectArticle();
        });

        document.getElementById('readingMode').addEventListener('click', () => {
            this.toggleReadingMode();
        });

        // Language and voice selection
        document.getElementById('languageSelect').addEventListener('change', (e) => {
            this.changeLanguage(e.target.value);
        });

        document.getElementById('voiceSelect').addEventListener('change', (e) => {
            this.changeVoice(e.target.value);
        });

        // Audio controls
        document.getElementById('playBtn').addEventListener('click', () => {
            this.playArticle();
        });

        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.pauseArticle();
        });

        document.getElementById('stopBtn').addEventListener('click', () => {
            this.stopArticle();
        });

        document.getElementById('bookmarkBtn').addEventListener('click', () => {
            this.saveBookmark();
        });

        // Speed control
        document.getElementById('speedRange').addEventListener('input', (e) => {
            this.changeSpeed(e.target.value);
        });

        // AI features
        document.getElementById('quickSummary').addEventListener('click', () => {
            this.generateSummary('quick');
        });

        document.getElementById('detailedSummary').addEventListener('click', () => {
            this.generateSummary('detailed');
        });

        document.getElementById('keyTakeaways').addEventListener('click', () => {
            this.generateSummary('takeaways');
        });

        document.getElementById('extractKeywords').addEventListener('click', () => {
            this.extractKeywords();
        });

        document.getElementById('translateArticle').addEventListener('click', () => {
            this.translateArticle();
        });

        document.getElementById('findRelated').addEventListener('click', () => {
            this.findRelatedArticles();
        });

        // Export and sharing
        document.getElementById('exportPDF').addEventListener('click', () => {
            this.exportContent('pdf');
        });

        document.getElementById('exportText').addEventListener('click', () => {
            this.exportContent('text');
        });

        document.getElementById('shareContent').addEventListener('click', () => {
            this.shareContent();
        });

        document.getElementById('addNotes').addEventListener('click', () => {
            this.toggleNotes();
        });

        document.getElementById('saveNotes').addEventListener('click', () => {
            this.saveNotes();
        });

        // Offline features
        document.getElementById('downloadArticle').addEventListener('click', () => {
            this.downloadForOffline();
        });

        document.getElementById('viewOffline').addEventListener('click', () => {
            this.viewOfflineArticles();
        });

        // Footer buttons
        document.getElementById('openOptions').addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });

        document.getElementById('viewHistory').addEventListener('click', () => {
            this.viewHistory();
        });
    }

    loadVoices() {
        if ('speechSynthesis' in window) {
            const voices = speechSynthesis.getVoices();
            this.voices = voices;
            this.populateVoiceSelect(voices);
        }
    }

    populateVoiceSelect(voices) {
        const voiceSelect = document.getElementById('voiceSelect');
        voiceSelect.innerHTML = '<option value="">Default</option>';
        
        voices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${voice.name} (${voice.lang})`;
            voiceSelect.appendChild(option);
        });
    }

    async loadSettings() {
        const settings = await chrome.storage.sync.get([
            'theme',
            'language',
            'voice',
            'speed',
            'fontSize'
        ]);

        if (settings.theme) {
            document.documentElement.setAttribute('data-theme', settings.theme);
            document.getElementById('themeToggle').textContent = settings.theme === 'dark' ? '☀️' : '🌙';
        }

        if (settings.language) {
            document.getElementById('languageSelect').value = settings.language;
        }

        if (settings.voice) {
            document.getElementById('voiceSelect').value = settings.voice;
        }

        if (settings.speed) {
            document.getElementById('speedRange').value = settings.speed;
            document.getElementById('speedValue').textContent = settings.speed + 'x';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        document.getElementById('themeToggle').textContent = newTheme === 'dark' ? '☀️' : '🌙';
        
        chrome.storage.sync.set({ theme: newTheme });
    }

    async detectArticle() {
        this.updateStatus('Detecting article...');
        this.setLoading('detectArticle', true);

        try {
            const [result] = await chrome.tabs.executeScript(this.currentTab.id, {
                function: () => {
                    return window.ArticleExtractor ? window.ArticleExtractor.extract() : null;
                }
            });

            if (result) {
                this.articleText = result.text;
                this.updateStatus(`Article detected: ${result.title}`);
                this.calculateDuration();
            } else {
                this.updateStatus('No article found');
            }
        } catch (error) {
            console.error('Error detecting article:', error);
            this.updateStatus('Error detecting article');
        } finally {
            this.setLoading('detectArticle', false);
        }
    }

    async toggleReadingMode() {
        try {
            await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'toggleReadingMode'
            });
        } catch (error) {
            console.error('Error toggling reading mode:', error);
        }
    }

    changeLanguage(language) {
        chrome.storage.sync.set({ language });
        this.loadVoices();
    }

    changeVoice(voiceIndex) {
        chrome.storage.sync.set({ voice: voiceIndex });
    }

    changeSpeed(speed) {
        document.getElementById('speedValue').textContent = speed + 'x';
        chrome.storage.sync.set({ speed });
    }

    async playArticle() {
        if (!this.articleText) {
            await this.detectArticle();
            if (!this.articleText) return;
        }

        this.updateStatus('Playing...');
        this.isPlaying = true;
        
        try {
            await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'playArticle',
                text: this.articleText,
                position: this.currentPosition,
                settings: await this.getAudioSettings()
            });
        } catch (error) {
            console.error('Error playing article:', error);
            this.updateStatus('Error playing article');
        }
    }

    async pauseArticle() {
        this.isPlaying = false;
        this.updateStatus('Paused');
        
        try {
            await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'pauseArticle'
            });
        } catch (error) {
            console.error('Error pausing article:', error);
        }
    }

    async stopArticle() {
        this.isPlaying = false;
        this.currentPosition = 0;
        this.updateProgress(0);
        this.updateStatus('Stopped');
        
        try {
            await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'stopArticle'
            });
        } catch (error) {
            console.error('Error stopping article:', error);
        }
    }

    async saveBookmark() {
        if (!this.articleText) return;
        
        const bookmark = {
            url: this.currentTab.url,
            title: this.currentTab.title,
            position: this.currentPosition,
            timestamp: Date.now()
        };

        try {
            const { bookmarks = [] } = await chrome.storage.local.get(['bookmarks']);
            bookmarks.push(bookmark);
            await chrome.storage.local.set({ bookmarks });
            
            this.updateStatus('Bookmark saved');
            setTimeout(() => this.updateStatus('Ready'), 2000);
        } catch (error) {
            console.error('Error saving bookmark:', error);
        }
    }

    async getAudioSettings() {
        const settings = await chrome.storage.sync.get([
            'language',
            'voice',
            'speed'
        ]);

        return {
            language: settings.language || 'en',
            voice: settings.voice || '',
            speed: parseFloat(settings.speed) || 1.0
        };
    }

    calculateDuration() {
        if (!this.articleText) return;
        
        // Estimate reading time based on average words per minute
        const wordsPerMinute = 200;
        const words = this.articleText.split(' ').length;
        this.totalDuration = Math.ceil((words / wordsPerMinute) * 60); // in seconds
        
        document.getElementById('totalTime').textContent = this.formatTime(this.totalDuration);
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    updateProgress(position) {
        this.currentPosition = position;
        const percentage = this.totalDuration > 0 ? (position / this.totalDuration) * 100 : 0;
        
        document.getElementById('progressFill').style.width = percentage + '%';
        document.getElementById('currentTime').textContent = this.formatTime(position);
    }

    updateStatus(message) {
        document.getElementById('statusText').textContent = message;
    }

    setLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    async generateSummary(type) {
        if (!this.articleText) {
            await this.detectArticle();
            if (!this.articleText) return;
        }

        this.updateStatus('Generating summary...');
        this.setLoading(type === 'quick' ? 'quickSummary' : 
                      type === 'detailed' ? 'detailedSummary' : 'keyTakeaways', true);

        try {
            const response = await this.callAI('summarize', {
                text: this.articleText,
                type: type,
                language: document.getElementById('languageSelect').value
            });

            this.displaySummary(response.summary);
            this.updateStatus('Summary generated');
        } catch (error) {
            console.error('Error generating summary:', error);
            this.updateStatus('Error generating summary');
        } finally {
            this.setLoading(type === 'quick' ? 'quickSummary' : 
                          type === 'detailed' ? 'detailedSummary' : 'keyTakeaways', false);
        }
    }

    async extractKeywords() {
        if (!this.articleText) {
            await this.detectArticle();
            if (!this.articleText) return;
        }

        this.updateStatus('Extracting keywords...');
        this.setLoading('extractKeywords', true);

        try {
            const response = await this.callAI('keywords', {
                text: this.articleText,
                language: document.getElementById('languageSelect').value
            });

            this.displayKeywords(response.keywords);
            this.updateStatus('Keywords extracted');
        } catch (error) {
            console.error('Error extracting keywords:', error);
            this.updateStatus('Error extracting keywords');
        } finally {
            this.setLoading('extractKeywords', false);
        }
    }

    async translateArticle() {
        if (!this.articleText) {
            await this.detectArticle();
            if (!this.articleText) return;
        }

        const targetLanguage = document.getElementById('languageSelect').value;
        this.updateStatus('Translating article...');
        this.setLoading('translateArticle', true);

        try {
            const response = await this.callAI('translate', {
                text: this.articleText,
                targetLanguage: targetLanguage
            });

            this.articleText = response.translatedText;
            this.updateStatus('Article translated');
        } catch (error) {
            console.error('Error translating article:', error);
            this.updateStatus('Error translating article');
        } finally {
            this.setLoading('translateArticle', false);
        }
    }

    async findRelatedArticles() {
        if (!this.articleText) {
            await this.detectArticle();
            if (!this.articleText) return;
        }

        this.updateStatus('Finding related articles...');
        this.setLoading('findRelated', true);

        try {
            const response = await this.callAI('related', {
                text: this.articleText,
                url: this.currentTab.url
            });

            this.displayRelatedArticles(response.articles);
            this.updateStatus('Related articles found');
        } catch (error) {
            console.error('Error finding related articles:', error);
            this.updateStatus('Error finding related articles');
        } finally {
            this.setLoading('findRelated', false);
        }
    }

    async callAI(action, data) {
        // This would typically call an AI service API
        // For demo purposes, we'll simulate responses
        return new Promise((resolve) => {
            setTimeout(() => {
                switch (action) {
                    case 'summarize':
                        resolve({
                            summary: this.generateMockSummary(data.type)
                        });
                        break;
                    case 'keywords':
                        resolve({
                            keywords: this.generateMockKeywords()
                        });
                        break;
                    case 'translate':
                        resolve({
                            translatedText: '[Translated] ' + data.text.substring(0, 200) + '...'
                        });
                        break;
                    case 'related':
                        resolve({
                            articles: this.generateMockRelatedArticles()
                        });
                        break;
                    default:
                        resolve({});
                }
            }, 2000);
        });
    }

    generateMockSummary(type) {
        const summaries = {
            quick: 'This article discusses the main topic with key points including important concepts and conclusions.',
            detailed: 'This comprehensive article covers multiple aspects of the topic, providing detailed analysis, examples, and supporting evidence. The main arguments are well-structured and lead to significant conclusions.',
            takeaways: '• Key insight 1\n• Important point 2\n• Main conclusion 3\n• Action item 4'
        };
        return summaries[type] || summaries.quick;
    }

    generateMockKeywords() {
        return ['Technology', 'Innovation', 'Analysis', 'Research', 'Development', 'Future', 'Impact', 'Solutions'];
    }

    generateMockRelatedArticles() {
        return [
            { title: 'Related Article 1', url: 'https://example.com/1' },
            { title: 'Related Article 2', url: 'https://example.com/2' },
            { title: 'Related Article 3', url: 'https://example.com/3' }
        ];
    }

    displaySummary(summary) {
        const summaryContent = document.getElementById('summaryContent');
        const summaryText = document.getElementById('summaryText');
        
        summaryText.innerHTML = summary.replace(/\n/g, '<br>');
        summaryContent.classList.remove('hidden');
        
        // Hide other content
        document.getElementById('keywordsContent').classList.add('hidden');
        document.getElementById('notesContent').classList.add('hidden');
    }

    displayKeywords(keywords) {
        const keywordsContent = document.getElementById('keywordsContent');
        const keywordsList = document.getElementById('keywordsList');
        
        keywordsList.innerHTML = keywords.map(keyword => 
            `<span class="keyword">${keyword}</span>`
        ).join('');
        
        keywordsContent.classList.remove('hidden');
        
        // Hide other content
        document.getElementById('summaryContent').classList.add('hidden');
        document.getElementById('notesContent').classList.add('hidden');
    }

    displayRelatedArticles(articles) {
        // For now, just show in console - could be enhanced to show in UI
        console.log('Related articles:', articles);
        alert('Related articles found (check console for details)');
    }

    toggleNotes() {
        const notesContent = document.getElementById('notesContent');
        notesContent.classList.toggle('hidden');
        
        if (!notesContent.classList.contains('hidden')) {
            this.loadNotes();
        }
    }

    async loadNotes() {
        try {
            const { notes = {} } = await chrome.storage.local.get(['notes']);
            const articleNotes = notes[this.currentTab.url] || '';
            document.getElementById('notesText').value = articleNotes;
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    }

    async saveNotes() {
        const notesText = document.getElementById('notesText').value;
        
        try {
            const { notes = {} } = await chrome.storage.local.get(['notes']);
            notes[this.currentTab.url] = notesText;
            await chrome.storage.local.set({ notes });
            
            this.updateStatus('Notes saved');
            setTimeout(() => this.updateStatus('Ready'), 2000);
        } catch (error) {
            console.error('Error saving notes:', error);
            this.updateStatus('Error saving notes');
        }
    }

    async exportContent(format) {
        const content = this.getExportContent();
        
        if (format === 'pdf') {
            this.exportAsPDF(content);
        } else if (format === 'text') {
            this.exportAsText(content);
        }
    }

    getExportContent() {
        const title = this.currentTab.title;
        const url = this.currentTab.url;
        const summary = document.getElementById('summaryText').textContent;
        const notes = document.getElementById('notesText').value;
        
        return {
            title,
            url,
            summary,
            notes,
            timestamp: new Date().toISOString()
        };
    }

    exportAsPDF(content) {
        // This would typically use a PDF generation library
        // For demo purposes, we'll create a simple text representation
        const pdfContent = `
Title: ${content.title}
URL: ${content.url}
Date: ${new Date(content.timestamp).toLocaleDateString()}

Summary:
${content.summary}

Notes:
${content.notes}
        `;
        
        this.downloadFile(pdfContent, 'article-export.txt', 'text/plain');
    }

    exportAsText(content) {
        const textContent = `
Title: ${content.title}
URL: ${content.url}
Date: ${new Date(content.timestamp).toLocaleDateString()}

Summary:
${content.summary}

Notes:
${content.notes}
        `;
        
        this.downloadFile(textContent, 'article-export.txt', 'text/plain');
    }

    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    shareContent() {
        const content = this.getExportContent();
        const shareText = `${content.title}\n${content.url}\n\nSummary: ${content.summary}`;
        
        if (navigator.share) {
            navigator.share({
                title: content.title,
                text: shareText,
                url: content.url
            });
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(shareText).then(() => {
                this.updateStatus('Content copied to clipboard');
                setTimeout(() => this.updateStatus('Ready'), 2000);
            });
        }
    }

    async downloadForOffline() {
        if (!this.articleText) {
            await this.detectArticle();
            if (!this.articleText) return;
        }

        const offlineArticle = {
            title: this.currentTab.title,
            url: this.currentTab.url,
            text: this.articleText,
            timestamp: Date.now()
        };

        try {
            const { offlineArticles = [] } = await chrome.storage.local.get(['offlineArticles']);
            offlineArticles.push(offlineArticle);
            await chrome.storage.local.set({ offlineArticles });
            
            this.updateStatus('Article saved for offline reading');
            setTimeout(() => this.updateStatus('Ready'), 2000);
        } catch (error) {
            console.error('Error saving offline article:', error);
            this.updateStatus('Error saving article');
        }
    }

    viewOfflineArticles() {
        // This would open a new page/popup showing offline articles
        chrome.tabs.create({
            url: chrome.runtime.getURL('offline/offline.html')
        });
    }

    viewHistory() {
        // This would open a new page/popup showing reading history
        chrome.tabs.create({
            url: chrome.runtime.getURL('history/history.html')
        });
    }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ArticleReaderPopup();
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateProgress') {
        // Update progress bar
        const popup = window.articleReaderPopup;
        if (popup) {
            popup.updateProgress(request.position);
        }
    }
});