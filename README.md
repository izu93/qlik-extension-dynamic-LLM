# Dynamic LLM Qlik Extension

A powerful **Qlik Cloud** extension built with **Nebula.js Supernova React framework** that enables dynamic interaction with Large Language Models (LLMs) directly within your Qlik applications. Users can modify prompts, adjust model parameters, and analyze LLM responses in real-time without leaving the Qlik environment.

## Features

- **Dynamic Parameter Control**: Adjust Temperature, Top K, Top P, and Max Tokens on the fly
- **Real-time Prompt Engineering**: Modify system prompts and user questions dynamically
- **Variable Injection**: Support for dynamic variables within prompts
- **Context Block Integration**: Include additional data like SHAP values or CRM signals
- **SSE Connection Management**: Seamlessly connect to Qlik's Server-Side Extensions
- **Interactive UI**: User-friendly interface for all LLM configuration options

## Requirements

### Prerequisites
- **Qlik Cloud** subscription with extension development access
- **Node.js** (v16 or higher) and npm
- **Nebula.js Supernova** development environment
- LLM service endpoint (OpenAI, Claude, local models, etc.)
- Analytics connection configured in Qlik Cloud

### Supported Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| **Connection Name** | Text/Dropdown | Yes | - | Name of the Qlik Cloud analytics connection |
| **System Prompt/Role** | Multiline Text | No | NULL | Instructions to frame the model's behavior |
| **User Prompt/Question** | Multiline Text | Yes | - | Main content for the model to respond to |
| **Dynamic Variables** | Key-Value Pairs | No | - | Variables to inject into prompts dynamically |
| **Context Block** | Multiline Text | No | - | Additional data (SHAP values, CRM signals, etc.) |
| **Temperature** | Number (0-1) | No | 0.7 | Controls randomness: 0=deterministic, 1=creative |
| **Top K** | Integer | No | 250 | Limits token choices to top K most likely tokens |
| **Top P** | Number (0-1) | No | 1.0 | Nucleus sampling threshold |
| **Max Tokens** | Integer | No | 1000 | Maximum tokens in response |

## Installation

### Step 1: Clone the Repository
```bash
git clone https://github.com/izu93/qlik-extension-dynamic-LLM.git
cd qlik-extension-dynamic-LLM
```

### Step 2: Install Nebula.js Dependencies
```bash
npm install
```

### Step 3: Development Setup
```bash
# Start development server
npm run start
```

### Step 4: Deploy to Qlik Cloud
1. **Build the extension:**
   ```bash
   npm run build
   ```

2. **Upload to Qlik Cloud:**
   - Navigate to your Qlik Cloud tenant
   - Go to Management Console > Extensions
   - Upload the built extension package
   - Enable the extension for your spaces

### Step 5: Configure Analytics Connection
1. Set up your LLM service endpoint in Qlik Cloud
2. Configure Analytics Connection in Management Console
3. Test the connection in your Qlik Cloud app

## Usage

### Basic Setup
1. Add the **Dynamic LLM** extension to your Qlik Cloud sheet
2. Configure the **Connection Name** to point to your analytics connection
3. Enter your **User Prompt/Question**
4. Adjust parameters as needed
5. Execute and analyze the response

### Advanced Features

#### Dynamic Variables
Use placeholder syntax in your prompts:
```
User Prompt: "Analyze the sales performance for {{product_name}} in {{time_period}}"

Dynamic Variables:
- product_name: "Wireless Headphones"
- time_period: "Q4 2024"
```

#### Context Block Integration
Include additional data for richer analysis:
```
Context Block:
- Customer sentiment scores
- SHAP feature importance values
- Historical performance data
- Market trend indicators
```

#### Parameter Optimization
- **Temperature (0-1)**: Lower for consistent responses, higher for creativity
- **Top K**: Reduce for focused responses, increase for variety
- **Top P**: Fine-tune token probability distribution
- **Max Tokens**: Control response length

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Qlik Cloud    │    │   Analytics      │    │   LLM Service   │
│   Extension     │◄──►│   Connection     │◄──►│  (OpenAI/etc)   │
│  (Nebula.js)    │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Development

### Project Structure
```
dynamicLLM/
├── package.json             # Nebula.js Supernova dependencies
├── src/
│   ├── index.js            # Main Supernova entry point
│   ├── object-properties.js # Property panel definitions
│   ├── data.js             # Data handling logic
│   └── ext.js              # Extension logic with React components
├── .babelrc                # Babel configuration
├── webpack.config.js       # Webpack build configuration
└── README.md              # This file
```

### Building the Extension
```bash
# Development mode
npm run dev

# Production build
npm run build

# Package for distribution
npm run package
```

### Testing
```bash
# Run unit tests
npm test

# Integration tests with Qlik
npm run test:integration
```

## Use Cases

### Business Intelligence
- **Automated Report Generation**: Generate insights from data automatically
- **Natural Language Queries**: Ask questions about your data in plain English
- **Trend Analysis**: Get AI-powered interpretations of business trends

### Advanced Analytics
- **Predictive Insights**: Combine machine learning outputs with LLM analysis
- **Feature Explanation**: Use SHAP values to explain model decisions
- **Anomaly Investigation**: Let AI help investigate data anomalies

### Customer Analytics
- **Sentiment Analysis**: Analyze customer feedback and reviews
- **Personalization**: Generate personalized recommendations
- **Churn Analysis**: Understand and predict customer behavior

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Troubleshooting

### Common Issues

**Connection Error**: "Cannot connect to analytics endpoint"
- Verify analytics connection is configured in Qlik Cloud
- Check connection status in Management Console
- Validate network connectivity and credentials

**Invalid Parameters**: "Temperature must be between 0 and 1"
- Check parameter ranges in the UI
- Validate input types match requirements

**Token Limit Exceeded**: "Response truncated"
- Reduce Max Tokens parameter
- Simplify your prompt
- Use shorter context blocks

### Support
- Email: [karthik.burra@qlik.com]
- Issues: [GitHub Issues](https://github.com/izu93/qlik-extension-dynamic-LLM/issues)
- Discussions: [GitHub Discussions](https://github.com/izu93/qlik-extension-dynamic-LLM/discussions)

## Roadmap

- [ ] **v1.1**: Multi-model support (Claude, OpenAI)
- [ ] **v1.2**: Prompt templates library
- [ ] **v1.3**: Response caching and history
- [ ] **v1.4**: Advanced visualizations for LLM outputs
- [ ] **v2.0**: Integrated fine-tuning capabilities

---

**Built for the Qlik Community**

*Transform your data analysis with the power of AI - right within Qlik Cloud!*