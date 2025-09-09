# User Guide - Multi-Provider AI Assessment System

## 🎯 Quick Start Guide

### 1. Access the Application
- Open your browser and navigate to: `http://localhost:3001`
- The quiz application will load with AI assessment **disabled by default**

### 2. Enable AI Assessment
- Locate the **"AI-Powered Assessment"** section at the top of the page
- Click the **toggle switch** to turn AI assessment **ON**
- The configuration section will slide down with provider options

### 3. Choose Your AI Provider
Select one of the available AI providers:

#### OpenAI (ChatGPT)
- **Best for**: General knowledge, detailed explanations, creative responses
- **Models**: GPT-3.5 Turbo, GPT-4
- **API Key Format**: `sk-proj-...` or `sk-...`
- **Get Key**: [OpenAI Platform](https://platform.openai.com/api-keys)

#### Google Gemini
- **Best for**: Technical analysis, structured responses, multilingual support
- **Models**: Gemini Pro
- **API Key Format**: `AI...` (AI + 38 characters)
- **Get Key**: [Google AI Studio](https://makersuite.google.com/app/apikey)

### 4. Configure Your API Key
1. **Select a provider** by clicking on the provider card
2. **Enter your API key** in the input field that appears
3. **Click "Validate Key"** to test and secure your key
4. **Wait for confirmation** - you'll see a green success message

### 5. Start Your Quiz
- **Upload a CSV file** with questions (optional)
- **Configure quiz settings** (timer, number of questions, etc.)
- **Click "Start Quiz"** 
- **Answer questions** and receive AI-powered feedback

## 🔧 Detailed Instructions

### API Key Management

#### Getting Your API Keys

**For OpenAI:**
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. **Important**: You need billing set up for API access

**For Google Gemini:**
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API key"
4. Copy the key (starts with `AI`)
5. **Note**: Free tier available with rate limits

#### Key Security Features
- 🔒 **Session-only storage** - Keys are never saved permanently
- 🔐 **Encryption** - Keys are encrypted before transmission
- 👁️ **Input masking** - Keys are partially hidden in the interface
- 🗑️ **Easy clearing** - One-click to remove and reset

### Provider Comparison

| Feature | OpenAI (ChatGPT) | Google Gemini |
|---------|------------------|---------------|
| **Strengths** | Creative, conversational, detailed explanations | Technical accuracy, structured responses |
| **Best For** | Literature, creative writing, general knowledge | Science, math, programming, analysis |
| **Response Style** | Natural, conversational | Precise, analytical |
| **Cost** | Pay-per-token | Free tier + paid options |
| **Rate Limits** | Depends on tier | 60 requests/minute (free) |

### Quiz Configuration

#### CSV Question Format
Your CSV file should include these columns:
```
Question,Option A,Option B,Option C,Option D,Correct Answer,Section,Difficulty
```

**Example:**
```csv
Question,Option A,Option B,Option C,Option D,Correct Answer,Section,Difficulty
"What is the capital of France?","London","Berlin","Paris","Madrid","C","Geography","easy"
```

#### Quiz Settings
- **Timer Mode**: None, Exam (overall), Section, or Question-based
- **Question Count**: Choose how many questions to include
- **Randomization**: Shuffle questions and answers
- **Passing Score**: Set the minimum percentage to pass
- **Show Answers**: Display correct answers in results

### AI Assessment Features

#### What AI Provides
- ✨ **Personalized feedback** for each answer
- 📈 **Performance analysis** and learning insights
- 🎯 **Study recommendations** based on weak areas
- 💡 **Explanations** for both correct and incorrect answers
- 📝 **Overall assessment** with actionable advice

#### Example AI Responses

**Correct Answer:**
> 🤖 AI Tutor: Excellent work! Your answer is correct. Paris is indeed the capital of France. This city has been the political and cultural center of France for centuries, housing important government institutions and serving as the country's economic hub.

**Incorrect Answer:**
> 🤖 AI Tutor: Not quite right. You selected London, but the correct answer is Paris. London is the capital of the United Kingdom, while Paris serves as France's capital. Remember that European capitals can be tricky - try associating each country with its most famous landmarks to help remember!

## 🛠️ Troubleshooting

### Common Issues

#### "Invalid API Key Format"
- **OpenAI keys** should start with `sk-` and be 48+ characters
- **Gemini keys** should start with `AI` and be 40 characters total
- Check for extra spaces or missing characters

#### "Validation Failed: 401 Unauthorized"
- Your API key is invalid or expired
- Check if you copied the full key correctly
- Verify your account has API access enabled
- For OpenAI: Ensure billing is set up

#### "Quota Exceeded"
- You've reached your API usage limit
- Check your billing dashboard
- Wait for quota reset or upgrade your plan

#### "AI Service Temporarily Down"
- The AI provider is experiencing issues
- Try switching to a different provider
- Wait a few minutes and try again

#### "Network Error During Validation"
- Check your internet connection
- Ensure the server is running
- Try refreshing the page

### Error Recovery
- **Click "Clear"** to reset and try a different provider
- **Toggle AI OFF and ON** to restart the configuration
- **Refresh the page** if you encounter persistent issues
- **Check browser console** for detailed error messages

## 🔒 Security & Privacy

### Data Protection
- **API keys** are encrypted and never stored permanently
- **Session-only** storage means keys are cleared when you close the browser
- **No server logging** of API keys or personal data
- **Local processing** - quiz data stays on your device

### Best Practices
- **Never share** your API keys with others
- **Use separate keys** for different applications
- **Monitor usage** in your provider dashboard
- **Revoke keys** if you suspect they're compromised

### Privacy Features
- **Input masking** hides your API key while typing
- **Secure transmission** encrypts data between browser and server
- **No persistence** means no data traces after session ends
- **Provider isolation** - keys work only with selected provider

## 📱 Device Compatibility

### Supported Browsers
- ✅ **Chrome** 80+ (recommended)
- ✅ **Firefox** 75+
- ✅ **Safari** 13+
- ✅ **Edge** 80+

### Mobile Support
- ✅ **Responsive design** works on all screen sizes
- ✅ **Touch-friendly** interface with large buttons
- ✅ **Gesture support** for navigation
- ✅ **Progressive enhancement** - works without JavaScript

### Accessibility
- ✅ **Screen reader** compatible
- ✅ **Keyboard navigation** support
- ✅ **High contrast** mode support
- ✅ **Reduced motion** respect

## 🚀 Advanced Features

### Keyboard Shortcuts
- **Alt + H**: Show help information
- **Enter**: Validate API key (when focused on input)
- **Escape**: Clear current API key
- **Tab**: Navigate between interface elements

### Performance Tips
- **Use Chrome** for best performance
- **Close other tabs** during quiz for optimal AI response times
- **Stable internet** connection recommended for AI features
- **Upload smaller CSV files** (under 1000 questions) for faster loading

### Integration Options
- **Export results** as CSV for analysis
- **Save configurations** for reuse
- **Bookmark** with specific settings
- **Share quiz links** (without API keys)

## 🎓 Educational Best Practices

### For Students
1. **Read AI feedback carefully** - it provides learning insights
2. **Try different providers** to see various explanation styles
3. **Use AI suggestions** to identify study areas
4. **Take notes** on AI recommendations for later review

### For Educators
1. **Test both providers** to see which fits your subject
2. **Review AI responses** to ensure accuracy for your domain
3. **Set clear expectations** about AI assistance vs. cheating
4. **Use analytics** to identify common problem areas

### Quiz Design Tips
- **Write clear questions** for better AI analysis
- **Include context** in questions when needed
- **Use consistent answer formats** (A/B/C/D)
- **Test your CSV** with a few questions first

## 📞 Support & Resources

### Getting Help
- **Check this user guide** first for common solutions
- **Review error messages** carefully - they provide specific guidance
- **Test with sample data** to isolate issues
- **Check provider status** pages for service outages

### Additional Resources
- **OpenAI Documentation**: [platform.openai.com/docs](https://platform.openai.com/docs)
- **Google Gemini Docs**: [ai.google.dev](https://ai.google.dev)
- **CSV Format Guide**: Included in application
- **API Rate Limits**: Check provider documentation

---

**🎯 You're now ready to create powerful AI-enhanced quizzes!** Start with the toggle switch and follow the step-by-step process. The system will guide you through each step with clear visual feedback and helpful error messages.
