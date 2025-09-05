// CSV Question Manager
class CSVQuestionManager {
    constructor() {
        this.questions = [];
        this.categories = new Set();
        this.difficulties = new Set();
    }

    // Parse CSV text into question objects
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        this.questions = [];
        this.categories.clear();
        this.difficulties.clear();

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                const question = {};
                headers.forEach((header, index) => {
                    question[header] = values[index];
                });
                
                // Convert numeric fields
                question.id = parseInt(question.id);
                question.points = parseInt(question.points || 1);
                question.time_limit = parseInt(question.time_limit || 30);
                
                // Track categories and difficulties
                this.categories.add(question.category);
                this.difficulties.add(question.difficulty);
                
                this.questions.push(question);
            }
        }
        
        return this.questions;
    }

    // Parse a single CSV line, handling commas within quotes
    parseCSVLine(line) {
        try {
            this.validateCSVLine(line);
            return this.processCSVLine(line);
        } catch (error) {
            return this.handleCSVParseError(error, line);
        }
    }

    // Validate CSV line input
    validateCSVLine(line) {
        if (typeof line !== 'string') {
            throw new Error('CSV line must be a string');
        }
        
        if (line.trim() === '') {
            throw new Error('Empty line');
        }
    }

    // Process the CSV line character by character
    processCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            try {
                const processResult = this.processCSVCharacter(char, line, i, inQuotes, current);
                current = processResult.current;
                inQuotes = processResult.inQuotes;
                i = processResult.newIndex;
                
                if (processResult.shouldPushField) {
                    result.push(current.trim());
                    current = '';
                }
            } catch (charError) {
                console.warn(`Error processing character at position ${i}:`, charError);
                current += char;
            }
        }
        
        if (inQuotes) {
            console.warn('Warning: Unclosed quotes detected in CSV line, attempting to recover');
        }
        
        result.push(current.trim());
        
        if (result.length === 0) {
            throw new Error('No fields found in CSV line');
        }
        
        return result;
    }

    // Process a single character in the CSV line
    processCSVCharacter(char, line, index, inQuotes, current) {
        if (char === '"') {
            const quoteResult = this.handleQuoteCharacter(line, index, inQuotes, current);
            return {
                current: quoteResult.current,
                inQuotes: quoteResult.inQuotes,
                newIndex: quoteResult.newIndex,
                shouldPushField: false
            };
        } else if (char === ',' && !inQuotes) {
            return {
                current: current,
                inQuotes: inQuotes,
                newIndex: index,
                shouldPushField: true
            };
        } else {
            return {
                current: current + char,
                inQuotes: inQuotes,
                newIndex: index,
                shouldPushField: false
            };
        }
    }

    // Handle quote character processing
    handleQuoteCharacter(line, index, inQuotes, current) {
        let newInQuotes = !inQuotes;
        let newCurrent = current;
        let newIndex = index;
        
        // Handle escaped quotes ("")
        if (index + 1 < line.length && line[index + 1] === '"' && newInQuotes) {
            newCurrent += '"';
            newIndex++; // Skip next quote
        }
        
        return {
            current: newCurrent,
            inQuotes: newInQuotes,
            newIndex: newIndex
        };
    }

    // Handle CSV parsing errors with fallback
    handleCSVParseError(error, line) {
        if (error.message === 'Empty line') {
            return [];
        }
        
        console.error('Error parsing CSV line:', error.message);
        console.error('Problematic line:', line);
        
        try {
            const fallbackResult = line.split(',').map(field => field.trim().replace(/^"|"$/g, ''));
            console.warn('Using fallback parsing method');
            return fallbackResult;
        } catch (fallbackError) {
            console.error('Fallback parsing also failed:', fallbackError);
            return [line];
        }
    }

    // Load questions from CSV file
    async loadQuestionsFromCSV(filename = 'questions.csv') {
        try {
            const response = await fetch(filename);
            if (!response.ok) {
                throw new Error(`Failed to load CSV: ${response.statusText}`);
            }
            const csvText = await response.text();
            return this.parseCSV(csvText);
        } catch (error) {
            console.error('Error loading CSV:', error);
            throw error;
        }
    }

    // Get all questions
    getAllQuestions() {
        return [...this.questions];
    }

    // Filter questions by criteria
    filterQuestions(criteria = {}) {
        return this.questions.filter(question => {
            if (criteria.category && question.category !== criteria.category) return false;
            if (criteria.difficulty && question.difficulty !== criteria.difficulty) return false;
            if (criteria.type && question.type !== criteria.type) return false;
            if (criteria.minPoints && question.points < criteria.minPoints) return false;
            if (criteria.maxPoints && question.points > criteria.maxPoints) return false;
            return true;
        });
    }

    // Get random subset of questions
    getRandomQuestions(count, criteria = {}) {
        const filtered = this.filterQuestions(criteria);
        if (filtered.length <= count) return filtered;
        
        const shuffled = [...filtered].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    // Get questions by category
    getQuestionsByCategory(category) {
        return this.questions.filter(q => q.category === category);
    }

    // Get questions by difficulty
    getQuestionsByDifficulty(difficulty) {
        return this.questions.filter(q => q.difficulty === difficulty);
    }

    // Get available categories
    getCategories() {
        return Array.from(this.categories);
    }

    // Get available difficulties
    getDifficulties() {
        return Array.from(this.difficulties);
    }

    // Convert question to quiz format (for compatibility with existing quiz system)
    convertToQuizFormat(csvQuestion) {
        return {
            id: csvQuestion.id,
            text: csvQuestion.question, // Use 'text' to match the quiz format
            options: [
                csvQuestion.option_a,
                csvQuestion.option_b,
                csvQuestion.option_c,
                csvQuestion.option_d
            ].filter(option => option && option.trim() !== ''),
            correct: [csvQuestion.correct_answer], // Convert to array format
            explanation: csvQuestion.explanation || '',
            category: csvQuestion.category,
            difficulty: csvQuestion.difficulty,
            points: csvQuestion.points || 1,
            timeLimit: csvQuestion.time_limit || 30
        };
    }

    // Convert all questions to quiz format
    convertAllToQuizFormat() {
        return this.questions.map(q => this.convertToQuizFormat(q));
    }

    // Export questions to CSV format
    exportToCSV() {
        if (this.questions.length === 0) return '';
        
        const headers = Object.keys(this.questions[0]);
        const csvLines = [headers.join(',')];
        
        this.questions.forEach(question => {
            const values = headers.map(header => {
                let value = question[header] || '';
                // Escape commas and quotes
                if (value.toString().includes(',') || value.toString().includes('"')) {
                    value = `"${value.toString().replace(/"/g, '""')}"`;
                }
                return value;
            });
            csvLines.push(values.join(','));
        });
        
        return csvLines.join('\n');
    }

    // Add a new question
    addQuestion(question) {
        // Ensure required fields
        if (!question.id) {
            question.id = Math.max(0, ...this.questions.map(q => q.id)) + 1;
        }
        
        // Set defaults
        question.points = question.points || 1;
        question.time_limit = question.time_limit || 30;
        question.type = question.type || 'multiple_choice';
        
        this.questions.push(question);
        this.categories.add(question.category);
        this.difficulties.add(question.difficulty);
        
        return question;
    }

    // Update an existing question
    updateQuestion(id, updates) {
        const index = this.questions.findIndex(q => q.id === parseInt(id));
        if (index === -1) return false;
        
        Object.assign(this.questions[index], updates);
        
        // Update categories and difficulties
        this.categories.add(this.questions[index].category);
        this.difficulties.add(this.questions[index].difficulty);
        
        return true;
    }

    // Delete a question
    deleteQuestion(id) {
        const index = this.questions.findIndex(q => q.id === parseInt(id));
        if (index === -1) return false;
        
        this.questions.splice(index, 1);
        
        // Rebuild categories and difficulties
        this.categories.clear();
        this.difficulties.clear();
        this.questions.forEach(q => {
            this.categories.add(q.category);
            this.difficulties.add(q.difficulty);
        });
        
        return true;
    }
}

// Export as ES6 module
export { CSVQuestionManager };
export default CSVQuestionManager;
