// Import necessary hooks from Nebula.js for Qlik Sense extensions
import { useElement, useLayout, useEffect, useApp } from "@nebula.js/stardust";

// Import modular configuration files
import objectProperties from "./object-properties";
import extensionDefinition from "./ext";
import dataConfiguration from "./data";

export default function supernova() {
  return {
    // QAE (Qlik Analytics Engine) configuration
    qae: {
      properties: objectProperties,
      data: dataConfiguration,
    },
    // Extension definition for property panel
    ext: extensionDefinition,
    // Main component function
    component() {
      // Get DOM element reference
      const element = useElement();
      // Get layout object with properties and data
      const layout = useLayout();
      // Get Qlik app instance for API calls
      const app = useApp();

      // Define prompt templates for advanced mode
      const getPromptTemplates = () => ({
        custom: {
          system: "",
          user: "",
        },
        shap_analysis: {
          system:
            "You are a customer analytics expert specializing in machine learning model interpretation and churn prediction. Focus on SHAP (SHapley Additive exPlanations) values to explain feature importance from the customer churn data.",
          user: "Based on the SHAP values provided in the data (automl_feature and SHAP_value columns), analyze which features have the strongest positive and negative impact on customer churn prediction. Focus on features like PlanType, BaseFee, ServiceRating, NumberOfPenalties, CurrentPeriodUsage, PriorPeriodUsage, AdditionalFeatureSpend, ServiceTickets, HasRenewed, Promotion, and StartWeek. Provide business interpretations and actionable recommendations for each key feature that drives or prevents churn.",
        },
        customer_risk_profile: {
          system:
            "You are a customer success manager specializing in risk assessment and proactive customer management using churn prediction data.",
          user: "Based on the customer data including AccountID, churn predictions (Churned_predicted, Churned_no, Churned_yes), and customer attributes (PlanType, BaseFee, ServiceRating, NumberOfPenalties, ServiceTickets, HasRenewed, CurrentPeriodUsage, PriorPeriodUsage, AdditionalFeatureSpend, Promotion, StartWeek), identify high-risk customer profiles. Focus on customers with high Churned_yes probabilities and specific combinations of risk factors. Recommend specific intervention strategies for different risk segments.",
        },
        customer_trends: {
          system:
            "You are a business intelligence analyst specializing in customer behavior analysis and trend identification for SaaS businesses.",
          user: "Analyze the customer data to identify key trends and patterns. Look at customer behavior over time, usage patterns, billing trends, service interactions, and renewal patterns. Identify emerging trends that could indicate opportunities for growth or areas of concern. Provide insights on customer segments, seasonal patterns, and recommendations for business strategy.",
        },
      });

      // Single Account Validation Function
      const validateSingleAccount = (layout) => {
        if (!layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.length) {
          return {
            valid: false,
            message: "No data available",
            accountCount: 0,
          };
        }

        const matrix = layout.qHyperCube.qDataPages[0].qMatrix;
        const dimensionInfo = layout.qHyperCube.qDimensionInfo || [];

        if (dimensionInfo.length === 0) {
          return {
            valid: false,
            message:
              "No dimensions found. Please add dimensions to analyze data.",
            accountCount: 0,
          };
        }

        // Check if first dimension has multiple unique values (assuming it's the key field like AccountID)
        const firstDimIndex = 0;
        const uniqueValues = [
          ...new Set(
            matrix
              .map(
                (row) => row[firstDimIndex]?.qText || row[firstDimIndex]?.qNum
              )
              .filter((val) => val !== null && val !== undefined && val !== "")
          ),
        ];

        const accountCount = uniqueValues.length;

        if (accountCount === 0) {
          return {
            valid: false,
            message: "No data records found",
            accountCount: 0,
          };
        }

        if (accountCount > 1) {
          const firstDimName = dimensionInfo[0]?.qFallbackTitle || "Key field";
          return {
            valid: false,
            message: `Multiple ${firstDimName} values selected (${accountCount}). Please filter to select exactly one record for AI analysis.`,
            accountCount: accountCount,
            values: uniqueValues.slice(0, 3),
          };
        }

        return {
          valid: true,
          accountCount: 1,
          selectedValue: uniqueValues[0],
          fieldName: dimensionInfo[0]?.qFallbackTitle || "Record",
          message: `Single record selected for analysis`,
        };
      };

      // Simplified dynamic field replacement function
      const replaceDynamicFields = (promptText, layout) => {
        if (!layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.length) {
          return promptText;
        }

        const matrix = layout.qHyperCube.qDataPages[0].qMatrix;
        const dimensionInfo = layout.qHyperCube.qDimensionInfo || [];
        const measureInfo = layout.qHyperCube.qMeasureInfo || [];

        // Create simple field mappings
        const fieldMap = {};

        // Add dimensions - keep it simple
        dimensionInfo.forEach((dim, index) => {
          const fieldName = dim.qFallbackTitle.toLowerCase();
          const values = matrix
            .map((row) => row[index]?.qText || row[index]?.qNum || "")
            .filter((v) => v !== "");
          const uniqueValues = [...new Set(values)];
          fieldMap[fieldName] = uniqueValues.slice(0, 5).join(", "); // Limit to 5 values
        });

        // Add measures - keep it simple
        measureInfo.forEach((measure, index) => {
          const fieldName = measure.qFallbackTitle.toLowerCase();
          const dimCount = dimensionInfo.length;
          const values = matrix.map((row) => {
            const val =
              row[dimCount + index]?.qNum || row[dimCount + index]?.qText || 0;
            return parseFloat(val) || 0;
          });

          // Just show the values, don't overcomplicate
          fieldMap[fieldName] = values
            .slice(0, 5)
            .map((v) => v.toString())
            .join(", ");
        });

        // Simple replacement without complex regex - support both {field} and {{field}}
        let replacedPrompt = promptText;

        Object.keys(fieldMap).forEach((fieldName) => {
          const placeholder = `{${fieldName}}`;
          const placeholderDouble = `{{${fieldName}}}`;
          const placeholderUpper = `{${fieldName.toUpperCase()}}`;
          const placeholderDoubleUpper = `{{${fieldName.toUpperCase()}}}`;

          replacedPrompt = replacedPrompt.replace(
            new RegExp(placeholder, "g"),
            fieldMap[fieldName]
          );
          replacedPrompt = replacedPrompt.replace(
            new RegExp(placeholderDouble, "g"),
            fieldMap[fieldName]
          );
          replacedPrompt = replacedPrompt.replace(
            new RegExp(placeholderUpper, "g"),
            fieldMap[fieldName]
          );
          replacedPrompt = replacedPrompt.replace(
            new RegExp(placeholderDoubleUpper, "g"),
            fieldMap[fieldName]
          );
        });

        return replacedPrompt;
      };

      // Get dynamic account info for header
      const getDynamicAccountInfo = (layout) => {
        if (!layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.length) {
          return "Analysis Ready";
        }

        const matrix = layout.qHyperCube.qDataPages[0].qMatrix;
        const dimensionInfo = layout.qHyperCube.qDimensionInfo || [];

        let accountInfo = "";

        // Look for AccountID dimension
        const accountIdIndex = dimensionInfo.findIndex((dim) =>
          dim.qFallbackTitle.toLowerCase().includes("account")
        );

        if (accountIdIndex !== -1 && matrix.length > 0) {
          const accountId =
            matrix[0][accountIdIndex]?.qText || matrix[0][accountIdIndex]?.qNum;
          if (accountId) {
            accountInfo = `Account: ${accountId}`;

            // Look for churn prediction if available
            const churnIndex = dimensionInfo.findIndex(
              (dim) =>
                dim.qFallbackTitle.toLowerCase().includes("churn") &&
                dim.qFallbackTitle.toLowerCase().includes("predict")
            );

            if (churnIndex !== -1) {
              const churnPrediction =
                matrix[0][churnIndex]?.qText || matrix[0][churnIndex]?.qNum;
              if (churnPrediction) {
                accountInfo += ` | Risk: ${churnPrediction}`;
              }
            }
          }
        }

        return accountInfo || `${matrix.length} Records Selected`;
      };

      // Effect hook to handle rendering and updates
      useEffect(() => {
        if (!element) return; // Exit if no element

        // Main render function
        const render = () => {
          // Extract properties from layout, with fallback
          const props = layout?.props || {};
          const templates = getPromptTemplates();
          const accountInfo = getDynamicAccountInfo(layout);

          // Apply custom styling
          const headerStyle = `
            background: ${props.headerBackgroundColor || "#ffffff"};
            color: ${props.headerTextColor || "#1a1a1a"};
            padding: ${props.padding || 20}px;
            border-radius: ${props.borderRadius || 8}px ${
            props.borderRadius || 8
          }px 0 0;
          `;

          const responseStyle = `
            background: ${props.responseBackgroundColor || "#f8f9fa"};
            color: ${props.responseTextColor || "#212529"};
            border: 1px solid ${props.responseBorderColor || "#e9ecef"};
            border-radius: ${props.borderRadius || 8}px;
            padding: 16px;
            font-size: ${props.fontSize || 14}px;
            text-align: ${props.textAlignment || "left"};
            line-height: 1.5;
            margin: 0;
          `;

          const buttonStyle = `
            background: linear-gradient(135deg, ${
              props.buttonBackgroundColor || "#667eea"
            } 0%, ${props.buttonBackgroundColor || "#764ba2"} 100%);
            color: ${props.buttonTextColor || "#ffffff"};
            border-radius: ${props.borderRadius || 8}px;
            padding: 12px 20px;
            font-size: ${(props.fontSize || 14) + 1}px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: all 0.2s ease;
          `;

          // Start building HTML content with custom styling
          let content = `
            <div style="
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              height: 100%;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              background: #ffffff;
            ">
              <!-- Header section with dynamic account info -->
              <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid #e0e0e0;
                ${headerStyle}
              ">
                <div style="display: flex; align-items: center;">
                  <span style="font-size: 24px; margin-right: 10px;">🤖</span>
                  <div>
                    <h2 style="
                      margin: 0;
                      font-size: 20px;
                      font-weight: 600;
                      color: inherit;
                    ">AI Analysis Results</h2>
                    <p style="
                      margin: 2px 0 0 0;
                      font-size: 13px;
                      opacity: 0.7;
                      color: inherit;
                    ">${accountInfo}</p>
                  </div>
                </div>
              </div>
          `;

          // Check if required configuration is missing
          if (
            !props.connectionName ||
            !props.systemPrompt ||
            !props.userPrompt
          ) {
            // Show enhanced configuration needed state
            const missingItems = [];
            if (!props.connectionName) missingItems.push("Connection Name");
            if (!props.systemPrompt) missingItems.push("System Prompt");
            if (!props.userPrompt) missingItems.push("User Prompt");

            content += `
              <div style="
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f8f9fa;
                border: 2px dashed #dee2e6;
                border-radius: 12px;
                text-align: center;
                color: #6c757d;
              ">
                <div>
                  <div style="font-size: 64px; margin-bottom: 16px; opacity: 0.3;">⚙️</div>
                  <h3 style="margin: 0 0 8px 0; color: #495057;">Configuration Required</h3>
                  <p style="margin: 0 0 12px 0; font-size: 14px;">Please configure the following in the properties panel:</p>
                  <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 500; color: #dc3545;">
                    ${missingItems.join(", ")}
                  </p>
                  
                  <!-- Additional helpful message -->
                  <div style="
                    background: #e3f2fd;
                    border: 1px solid #90caf9;
                    border-radius: 8px;
                    padding: 12px 16px;
                    margin: 16px auto 0 auto;
                    max-width: 400px;
                    font-size: 13px;
                    color: #1565c0;
                    text-align: left;
                  ">
                    <div style="font-weight: 600; margin-bottom: 6px;">💡 Quick Setup Tips:</div>
                    <div style="line-height: 1.4;">
                      • Use <strong>{{fieldName}}</strong> in prompts for dynamic data<br>
                      • Create Concat() measures in Qlik for multi-value fields<br>
                      • Use Round() functions in measures for number formatting<br>
                      • This extension works with any app - just configure your prompts!
                    </div>
                  </div>
                </div>
              </div>
            `;
          } else if (props.showAdvancedUI) {
            // Show advanced chat interface
            content += `
              <!-- Quick Prompt Buttons -->
              <div style="
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 16px;
                justify-content: flex-start;
              ">
                <button class="prompt-btn" data-template="shap_analysis" style="
                  padding: 12px 20px;
                  background: #ffffff;
                  color: #374151;
                  border: 1.5px solid #d1d5db;
                  border-radius: 25px;
                  cursor: pointer;
                  font-size: 14px;
                  text-align: center;
                  transition: all 0.2s ease;
                  font-weight: 500;
                  white-space: nowrap;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                ">
                  What features impact churn the most?
                </button>
                
                <button class="prompt-btn" data-template="customer_risk_profile" style="
                  padding: 12px 20px;
                  background: #ffffff;
                  color: #374151;
                  border: 1.5px solid #d1d5db;
                  border-radius: 25px;
                  cursor: pointer;
                  font-size: 14px;
                  text-align: center;
                  transition: all 0.2s ease;
                  font-weight: 500;
                  white-space: nowrap;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                ">
                  Which customers are at highest risk?
                </button>
                
                <button class="prompt-btn" data-template="customer_trends" style="
                  padding: 12px 20px;
                  background: #ffffff;
                  color: #374151;
                  border: 1.5px solid #d1d5db;
                  border-radius: 25px;
                  cursor: pointer;
                  font-size: 14px;
                  text-align: center;
                  transition: all 0.2s ease;
                  font-weight: 500;
                  white-space: nowrap;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                ">
                  Analyze customer trends
                </button>
              </div>
              
              <!-- Chat Messages Container -->
              <div id="llmResponse" style="
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                background: #f8f9fc;
                border-radius: 12px;
                font-size: 14px;
                line-height: 1.5;
                color: #212529;
                margin-bottom: 16px;
                min-height: 180px;
                max-height: 350px;
                border: 1px solid #e9ecf3;
              ">
                <!-- Initial AI message -->
                <div style="
                  display: flex;
                  justify-content: flex-start;
                  margin-bottom: 12px;
                ">
                  <div style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 18px 18px 18px 4px;
                    padding: 12px 16px;
                    max-width: 85%;
                    font-size: 13px;
                    line-height: 1.4;
                    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
                  ">
                    <div style="font-weight: 600; margin-bottom: 4px; opacity: 0.9;">🤖 AI Assistant</div>
                    💡 Ready to analyze your customer data! Use the suggestions above or ask me anything below.
                  </div>
                </div>
              </div>
              
              <!-- Chat input area -->
              <div style="
                display: flex;
                gap: 10px;
                align-items: flex-end;
                background: white;
                padding: 12px;
                border-radius: 25px;
                border: 1px solid #e9ecf3;
                box-shadow: 0 2px 12px rgba(0,0,0,0.08);
              ">
                <textarea id="chatInput" placeholder="Type your question here..." style="
                  flex: 1;
                  padding: 12px 16px;
                  border: none;
                  border-radius: 20px;
                  font-size: 14px;
                  font-family: inherit;
                  resize: none;
                  min-height: 20px;
                  max-height: 80px;
                  background: #f8f9fc;
                  color: #374151;
                  outline: none;
                  line-height: 1.4;
                "></textarea>
                
                <button id="generateButton" style="
                  ${buttonStyle}
                  min-width: 100px;
                  border-radius: 20px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 13px;
                  padding: 12px 20px;
                  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
                ">
                  ✨ Generate
                </button>
                
                <button id="clearButton" style="
                  padding: 12px 16px;
                  background: #f1f3f4;
                  color: #5f6368;
                  border: none;
                  border-radius: 20px;
                  cursor: pointer;
                  font-size: 13px;
                  font-weight: 500;
                  transition: all 0.2s ease;
                ">
                  Clear
                </button>
              </div>
            `;
          } else {
            // Show simple interface
            content += `
              <!-- Simple interface -->
              <div style="
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 12px;
              ">
                <!-- Main message area -->
                <div id="llmResponse" style="
                  flex: 1;
                  overflow-y: auto;
                  ${responseStyle}
                  text-align: left;
                  min-height: 200px;
                  max-height: 400px;
                ">
                  <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    text-align: center;
                    color: #6c757d;
                  ">
                    <div>
                      <div style="font-size: 32px; margin-bottom: 8px; opacity: 0.3;">📊</div>
                      <h3 style="margin: 0 0 4px 0; color: inherit; opacity: 0.8; font-size: 16px;">Ready for Analysis</h3>
                      <p style="margin: 0; opacity: 0.6; font-size: 12px;">Click Generate to start AI analysis</p>
                    </div>
                  </div>
                </div>
                
                <!-- Generate button -->
                <div style="text-align: center;">
                  <button id="generateButton" style="
                    ${buttonStyle}
                    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
                    min-width: 140px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                  ">
                    <span style="margin-right: 6px;">✨</span>
                    Generate Analysis
                  </button>
                </div>
              </div>
            `;
          }

          // Close main container
          content += `</div>`;

          // Set the generated HTML content
          element.innerHTML = content;

          // Add CSS styles
          const style = document.createElement("style");
          style.textContent = `
            .prompt-btn:hover {
              background: #f8f9fc !important;
              border-color: #667eea !important;
              transform: translateY(-1px);
              box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15) !important;
            }
            .prompt-btn:active {
              transform: translateY(0);
              background: #667eea !important;
              color: white !important;
            }
            #chatInput:focus {
              background: #ffffff !important;
              box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2) !important;
            }
            #generateButton:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5) !important;
            }
            #clearButton:hover {
              background: #e8eaed !important;
              transform: translateY(-1px);
            }
            #advancedToggle:hover {
              transform: translateY(-1px);
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            /* Scrollbar styling for chat */
            #llmResponse::-webkit-scrollbar {
              width: 6px;
            }
            #llmResponse::-webkit-scrollbar-track {
              background: #f1f3f4;
              border-radius: 3px;
            }
            #llmResponse::-webkit-scrollbar-thumb {
              background: #c1c8cd;
              border-radius: 3px;
            }
            #llmResponse::-webkit-scrollbar-thumb:hover {
              background: #a8b3ba;
            }
          `;
          document.head.appendChild(style);

          // Add event handlers
          const generateButton = element.querySelector("#generateButton");
          const clearButton = element.querySelector("#clearButton");
          const responseDiv = element.querySelector("#llmResponse");
          const chatInput = element.querySelector("#chatInput");
          const promptButtons = element.querySelectorAll(".prompt-btn");
          const advancedToggle = element.querySelector("#advancedToggle");

          // Advanced toggle handler
          if (advancedToggle) {
            advancedToggle.onclick = () => {
              // This would typically trigger a property update, but for demo we'll just show the state
              console.log(
                "Advanced UI toggle clicked - use properties panel to enable/disable"
              );
            };
          }

          // Auto-resize textarea (if in advanced mode)
          if (chatInput) {
            chatInput.addEventListener("input", function () {
              this.style.height = "auto";
              this.style.height = Math.min(this.scrollHeight, 120) + "px";
            });
          }

          // Prompt button handlers (advanced mode)
          // Prompt button handlers (advanced mode) - UPDATED VERSION
          promptButtons.forEach((btn) => {
            btn.onclick = async () => {
              const templateType = btn.dataset.template;
              if (templateType && templates[templateType]) {
                // First validate single account/record selection
                const validation = validateSingleAccount(layout);

                if (!validation.valid) {
                  // Show validation error
                  responseDiv.innerHTML = `
          <div style="
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 16px;
            color: #856404;
            text-align: center;
            line-height: 1.5;
          ">
            <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
            <h3 style="margin: 0 0 8px 0; color: inherit;">Selection Required</h3>
            <p style="margin: 0 0 12px 0; font-size: 14px;">${
              validation.message
            }</p>
            
            ${
              validation.accountCount > 1
                ? `
              <div style="
                background: #f8f9fa;
                border-radius: 6px;
                padding: 8px 12px;
                margin-top: 12px;
                font-size: 12px;
                color: #6c757d;
              ">
                <strong>Tip:</strong> Use filters or selections to narrow down to exactly one record before generating AI analysis.
              </div>
            `
                : ""
            }
          </div>
        `;
                  return;
                }

                // Show user's action immediately
                const buttonText = btn.textContent.trim();
                responseDiv.innerHTML += `
        <!-- User message -->
        <div style="
          display: flex;
          justify-content: flex-end;
          margin-bottom: 12px;
        ">
          <div style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 18px 18px 4px 18px;
            padding: 10px 16px;
            max-width: 75%;
            font-size: 13px;
            line-height: 1.4;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
          ">
            ${buttonText}
          </div>
        </div>
        
        <!-- Loading message -->
        <div id="loadingMsg" style="
          display: flex;
          justify-content: flex-start;
          margin-bottom: 12px;
        ">
          <div style="
            background: white;
            color: #6b7280;
            border-radius: 18px 18px 18px 4px;
            padding: 12px 16px;
            max-width: 85%;
            font-size: 13px;
            line-height: 1.4;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border: 1px solid #e9ecf3;
          ">
            <div style="font-weight: 600; margin-bottom: 6px; color: #667eea; font-size: 12px;">🤖 AI Assistant</div>
            <div style="display: flex; align-items: center;">
              <div style="
                width: 12px;
                height: 12px;
                border: 2px solid #e5e7eb;
                border-top: 2px solid #667eea;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-right: 8px;
              "></div>
              Processing with Claude AI...
            </div>
          </div>
        </div>
      `;

                // Scroll to bottom
                responseDiv.scrollTop = responseDiv.scrollHeight;

                // Disable all prompt buttons during processing
                promptButtons.forEach((button) => {
                  button.disabled = true;
                  button.style.opacity = "0.6";
                  button.style.cursor = "not-allowed";
                });

                try {
                  // Get template prompts
                  const template = templates[templateType];
                  let systemPrompt = template.system;
                  let userPrompt = template.user;

                  // Replace dynamic fields
                  systemPrompt = replaceDynamicFields(systemPrompt, layout);
                  userPrompt = replaceDynamicFields(userPrompt, layout);

                  let fullPrompt = userPrompt;
                  if (systemPrompt) {
                    fullPrompt = systemPrompt + "\n\n" + userPrompt;
                  }

                  // Add data context if hypercube data is available
                  if (layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.length > 0) {
                    fullPrompt += "\n\nData Context:\n";
                    const matrix = layout.qHyperCube.qDataPages[0].qMatrix;

                    // Add column headers if available
                    if (
                      layout.qHyperCube.qDimensionInfo?.length ||
                      layout.qHyperCube.qMeasureInfo?.length
                    ) {
                      const headers = [
                        ...layout.qHyperCube.qDimensionInfo.map(
                          (d) => d.qFallbackTitle
                        ),
                        ...layout.qHyperCube.qMeasureInfo.map(
                          (m) => m.qFallbackTitle
                        ),
                      ];
                      fullPrompt += headers.join(", ") + "\n";
                    }

                    // Add data rows to prompt
                    matrix.forEach((row, idx) => {
                      if (idx < 100) {
                        fullPrompt +=
                          row
                            .map((cell) => cell.qText || cell.qNum || "")
                            .join(", ") + "\n";
                      }
                    });

                    if (matrix.length > 100) {
                      fullPrompt += `... and ${
                        matrix.length - 100
                      } more rows\n`;
                    }
                  }

                  // Simplified escaping
                  const escapedPrompt = fullPrompt
                    .replace(/\\/g, "\\\\")
                    .replace(/"/g, '\\"')
                    .replace(/'/g, "\\'")
                    .replace(/\n/g, "\\n")
                    .replace(/\r/g, "\\r");

                  // Build Qlik expression to call LLM endpoint
                  const expression = `endpoints.ScriptEvalStr(
          '{"RequestType":"endpoint",
           "endpoint":{
             "connectionname":"${props.connectionName}",
             "column":"text",
             "parameters":{
               "temperature":"${props.temperature}",
               "Top K":"${props.topK}",
               "Top P":"${props.topP}",
               "max_tokens":"${props.maxTokens}"
             }}}',
          '${escapedPrompt}'
        )`;

                  // Execute the expression via Qlik's evaluation API
                  const response = await app.evaluate({
                    qExpression: expression,
                  });

                  const responseText =
                    response?.qText || response || "No response received";

                  // Remove loading message
                  const loadingMsg = responseDiv.querySelector("#loadingMsg");
                  if (loadingMsg) {
                    loadingMsg.remove();
                  }

                  // Add AI response
                  responseDiv.innerHTML += `
          <!-- AI response -->
          <div style="
            display: flex;
            justify-content: flex-start;
            margin-bottom: 12px;
          ">
            <div style="
              background: white;
              color: #374151;
              border-radius: 18px 18px 18px 4px;
              padding: 12px 16px;
              max-width: 85%;
              font-size: 13px;
              line-height: 1.4;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              border: 1px solid #e9ecf3;
            ">
              <div style="font-weight: 600; margin-bottom: 6px; color: #667eea; font-size: 12px;">🤖 AI Assistant</div>
              <div style="white-space: pre-wrap; word-wrap: break-word;">
                ${responseText.replace(/\n/g, "<br>")}
              </div>
            </div>
          </div>
        `;

                  // Scroll to bottom
                  responseDiv.scrollTop = responseDiv.scrollHeight;
                } catch (err) {
                  console.error("LLM Error:", err);

                  // Remove loading message
                  const loadingMsg = responseDiv.querySelector("#loadingMsg");
                  if (loadingMsg) {
                    loadingMsg.remove();
                  }

                  // Display error
                  responseDiv.innerHTML += `
          <div style="
            display: flex;
            justify-content: flex-start;
            margin-bottom: 12px;
          ">
            <div style="
              background: #fef2f2;
              border: 1px solid #fca5a5;
              border-radius: 18px 18px 18px 4px;
              padding: 12px 16px;
              max-width: 85%;
              font-size: 13px;
              line-height: 1.4;
              color: #dc2626;
            ">
              <div style="font-weight: 600; margin-bottom: 6px; color: #dc2626; font-size: 12px;">🤖 AI Assistant</div>
              <div>
                <strong>⚠️ Error:</strong> ${
                  err.message || "Failed to generate response"
                }
                <div style="margin-top: 4px; font-size: 11px; opacity: 0.8;">
                  Check your connection name and ensure the Claude SSE endpoint is properly configured.
                </div>
              </div>
            </div>
          </div>
        `;
                } finally {
                  // Re-enable all prompt buttons
                  promptButtons.forEach((button) => {
                    button.disabled = false;
                    button.style.opacity = "1";
                    button.style.cursor = "pointer";
                  });
                }
              }
            };
          });

          // Clear button handler
          if (clearButton && responseDiv) {
            clearButton.onclick = () => {
              if (props.showAdvancedUI) {
                // Reset to chat welcome message
                responseDiv.innerHTML = `
                  <div style="
                    display: flex;
                    justify-content: flex-start;
                    margin-bottom: 12px;
                  ">
                    <div style="
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white;
                      border-radius: 18px 18px 18px 4px;
                      padding: 12px 16px;
                      max-width: 85%;
                      font-size: 13px;
                      line-height: 1.4;
                      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
                    ">
                      <div style="font-weight: 600; margin-bottom: 4px; opacity: 0.9;">🤖 AI Assistant</div>
                      💡 Ready to analyze your customer data! Use the quick actions above or ask me anything below.
                    </div>
                  </div>
                `;
                if (chatInput) {
                  chatInput.value = "";
                  chatInput.style.height = "auto";
                }
              } else {
                // Reset to simple welcome message
                responseDiv.innerHTML = `
                  <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    text-align: center;
                    color: #6c757d;
                  ">
                    <div>
                      <div style="font-size: 32px; margin-bottom: 8px; opacity: 0.3;">📊</div>
                      <h3 style="margin: 0 0 4px 0; color: inherit; opacity: 0.8; font-size: 16px;">Ready for Analysis</h3>
                      <p style="margin: 0; opacity: 0.6; font-size: 12px;">Click Generate to start AI analysis</p>
                    </div>
                  </div>
                `;
              }
            };
          }

          // Enhanced Generate button handler with account validation
          if (generateButton && responseDiv) {
            generateButton.onclick = async () => {
              // First validate single account/record selection
              const validation = validateSingleAccount(layout);

              if (!validation.valid) {
                // Show validation error with helpful context
                responseDiv.innerHTML = `
                  <div style="
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                    border-radius: 8px;
                    padding: 16px;
                    color: #856404;
                    text-align: center;
                    line-height: 1.5;
                  ">
                    <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
                    <h3 style="margin: 0 0 8px 0; color: inherit;">Selection Required</h3>
                    <p style="margin: 0 0 12px 0; font-size: 14px;">${
                      validation.message
                    }</p>
                    
                    ${
                      validation.accountCount > 1
                        ? `
                      <div style="
                        background: #f8f9fa;
                        border-radius: 6px;
                        padding: 8px 12px;
                        margin-top: 12px;
                        font-size: 12px;
                        color: #6c757d;
                      ">
                        <strong>Tip:</strong> Use filters or selections to narrow down to exactly one record before generating AI analysis.
                      </div>
                    `
                        : ""
                    }
                  </div>
                `;
                return;
              }

              // Disable button during processing
              generateButton.disabled = true;
              generateButton.style.background =
                "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)";
              generateButton.innerHTML = `<span style="margin-right: 8px;">⏳</span>Analyzing ${validation.fieldName}: ${validation.selectedValue}...`;

              // Show loading state
              if (props.showAdvancedUI) {
                // Add user message first
                const userMessage =
                  chatInput && chatInput.value.trim()
                    ? chatInput.value.trim()
                    : "Generate analysis";

                responseDiv.innerHTML += `
                  <!-- User message -->
                  <div style="
                    display: flex;
                    justify-content: flex-end;
                    margin-bottom: 12px;
                  ">
                    <div style="
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white;
                      border-radius: 18px 18px 4px 18px;
                      padding: 10px 16px;
                      max-width: 75%;
                      font-size: 13px;
                      line-height: 1.4;
                      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
                    ">
                      ${userMessage}
                    </div>
                  </div>
                  
                  <!-- Loading message -->
                  <div id="loadingMsg" style="
                    display: flex;
                    justify-content: flex-start;
                    margin-bottom: 12px;
                  ">
                    <div style="
                      background: white;
                      color: #6b7280;
                      border-radius: 18px 18px 18px 4px;
                      padding: 12px 16px;
                      max-width: 85%;
                      font-size: 13px;
                      line-height: 1.4;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                      border: 1px solid #e9ecf3;
                    ">
                      <div style="font-weight: 600; margin-bottom: 6px; color: #667eea; font-size: 12px;">🤖 AI Assistant</div>
                      <div style="display: flex; align-items: center;">
                        <div style="
                          width: 12px;
                          height: 12px;
                          border: 2px solid #e5e7eb;
                          border-top: 2px solid #667eea;
                          border-radius: 50%;
                          animation: spin 1s linear infinite;
                          margin-right: 8px;
                        "></div>
                        Processing with Claude AI...
                      </div>
                    </div>
                  </div>
                `;

                // Scroll to bottom
                responseDiv.scrollTop = responseDiv.scrollHeight;
              } else {
                // Simple loading
                responseDiv.innerHTML = `
                  <div style="display: flex; flex-direction: column; align-items: center; color: #6c757d;">
                    <div style="
                      width: 32px;
                      height: 32px;
                      border: 3px solid #f3f3f3;
                      border-top: 3px solid #667eea;
                      border-radius: 50%;
                      animation: spin 1s linear infinite;
                      margin-bottom: 16px;
                    "></div>
                    <p style="margin: 0; font-size: 16px;">Analyzing ${validation.fieldName}: <strong>${validation.selectedValue}</strong></p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.7;">Processing with Claude AI...</p>
                  </div>
                `;
              }

              try {
                // Get prompts and replace dynamic fields using existing function
                let systemPrompt = props.systemPrompt || "";
                let userPrompt = props.userPrompt || "";

                // If advanced mode and chat input exists, use chat input
                if (props.showAdvancedUI && chatInput) {
                  const inputText = chatInput.value.trim();
                  if (inputText) {
                    // Check if it's a template button
                    const templateButton = Array.from(promptButtons).find(
                      (btn) => btn.textContent.trim() === inputText.trim()
                    );

                    if (templateButton) {
                      const templateType = templateButton.dataset.template;
                      const template = templates[templateType];
                      if (template) {
                        systemPrompt = template.system;
                        userPrompt = template.user;
                      }
                    } else {
                      // Use custom input as user prompt
                      userPrompt = inputText;
                    }
                  }
                }

                // Replace dynamic fields
                systemPrompt = replaceDynamicFields(systemPrompt, layout);
                userPrompt = replaceDynamicFields(userPrompt, layout);

                let fullPrompt = userPrompt;
                if (systemPrompt) {
                  fullPrompt = systemPrompt + "\n\n" + userPrompt;
                }

                // Add data context if hypercube data is available
                if (layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.length > 0) {
                  fullPrompt += "\n\nData Context:\n";
                  const matrix = layout.qHyperCube.qDataPages[0].qMatrix;

                  // Add column headers if available
                  if (
                    layout.qHyperCube.qDimensionInfo?.length ||
                    layout.qHyperCube.qMeasureInfo?.length
                  ) {
                    const headers = [
                      ...layout.qHyperCube.qDimensionInfo.map(
                        (d) => d.qFallbackTitle
                      ),
                      ...layout.qHyperCube.qMeasureInfo.map(
                        (m) => m.qFallbackTitle
                      ),
                    ];
                    fullPrompt += headers.join(", ") + "\n";
                  }

                  // Add data rows to prompt
                  matrix.forEach((row, idx) => {
                    if (idx < 100) {
                      fullPrompt +=
                        row
                          .map((cell) => cell.qText || cell.qNum || "")
                          .join(", ") + "\n";
                    }
                  });

                  if (matrix.length > 100) {
                    fullPrompt += `... and ${matrix.length - 100} more rows\n`;
                  }
                }

                // Simplified escaping - only escape what's absolutely necessary
                const escapedPrompt = fullPrompt
                  .replace(/\\/g, "\\\\") // Escape backslashes
                  .replace(/"/g, '\\"') // Escape double quotes
                  .replace(/'/g, "\\'") // Escape single quotes
                  .replace(/\n/g, "\\n") // Escape newlines
                  .replace(/\r/g, "\\r"); // Escape carriage returns

                // Build Qlik expression to call LLM endpoint
                const expression = `endpoints.ScriptEvalStr(
                  '{"RequestType":"endpoint",
                   "endpoint":{
                     "connectionname":"${props.connectionName}",
                     "column":"text",
                     "parameters":{
                       "temperature":"${props.temperature}",
                       "Top K":"${props.topK}",
                       "Top P":"${props.topP}",
                       "max_tokens":"${props.maxTokens}"
                     }}}',
                  '${escapedPrompt}'
                )`;

                // Execute the expression via Qlik's evaluation API
                const response = await app.evaluate({
                  qExpression: expression,
                });

                const responseText =
                  response?.qText || response || "No response received";

                // Display response based on mode
                if (props.showAdvancedUI) {
                  // Remove loading message first
                  const loadingMsg = responseDiv.querySelector("#loadingMsg");
                  if (loadingMsg) {
                    loadingMsg.remove();
                  }

                  // Add AI response
                  responseDiv.innerHTML += `
                    <!-- AI response -->
                    <div style="
                      display: flex;
                      justify-content: flex-start;
                      margin-bottom: 12px;
                    ">
                      <div style="
                        background: white;
                        color: #374151;
                        border-radius: 18px 18px 18px 4px;
                        padding: 12px 16px;
                        max-width: 85%;
                        font-size: 13px;
                        line-height: 1.4;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                        border: 1px solid #e9ecf3;
                      ">
                        <div style="font-weight: 600; margin-bottom: 6px; color: #667eea; font-size: 12px;">🤖 AI Assistant</div>
                        <div style="white-space: pre-wrap; word-wrap: break-word;">
                          ${responseText.replace(/\n/g, "<br>")}
                        </div>
                      </div>
                    </div>
                  `;

                  // Clear input and scroll to bottom
                  if (chatInput) {
                    chatInput.value = "";
                    chatInput.style.height = "auto";
                  }
                  responseDiv.scrollTop = responseDiv.scrollHeight;
                } else {
                  // Simple response with record context
                  responseDiv.innerHTML = `
                    <div style="margin-bottom: 12px; padding: 8px 12px; background: #e8f5e8; border-radius: 6px; font-size: 12px; color: #2e7d2e;">
                      <strong>Analysis for:</strong> ${
                        validation.fieldName
                      } = ${validation.selectedValue}
                    </div>
                    <div style="white-space: pre-wrap; word-wrap: break-word; line-height: 1.6;">
                      ${responseText.replace(/\n/g, "<br>")}
                    </div>
                  `;
                }
              } catch (err) {
                console.error("LLM Error:", err);

                // Display error based on mode
                const errorMessage = `
                  <div style="
                    background: #fef2f2;
                    border: 1px solid #fca5a5;
                    border-radius: 8px;
                    padding: 12px;
                    color: #dc2626;
                    text-align: left;
                    line-height: 1.5;
                    font-size: 13px;
                  ">
                    <div style="font-weight: 600; margin-bottom: 4px;">⚠️ Error</div>
                    ${err.message || "Failed to generate response"}
                    <div style="margin-top: 8px; font-size: 11px; opacity: 0.8;">
                      Check your connection name and ensure the Claude SSE endpoint is properly configured.
                    </div>
                  </div>
                `;

                responseDiv.innerHTML = errorMessage;
              } finally {
                // Re-enable button
                generateButton.disabled = false;
                generateButton.style.background =
                  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
                generateButton.style.boxShadow =
                  "0 2px 8px rgba(102, 126, 234, 0.3)";
                generateButton.innerHTML = props.showAdvancedUI
                  ? '<span style="margin-right: 6px;">✨</span>Generate'
                  : '<span style="margin-right: 6px;">✨</span>Generate Analysis';
              }
            };
          }

          // Enter key handler for chat input
          if (chatInput) {
            chatInput.addEventListener("keydown", (e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (generateButton) {
                  generateButton.click();
                }
              }
            });
          }
        };

        // Execute render function
        render();
      }, [element, layout, app]); // Re-run effect when dependencies change
    },
  };
}
