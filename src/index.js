// Streamlined index.js - Fully dynamic custom expression validation
import { useElement, useLayout, useEffect, useApp } from "@nebula.js/stardust";
import objectProperties from "./object-properties";
import extensionDefinition from "./ext";
import dataConfiguration from "./data";

export default function supernova() {
  return {
    qae: {
      properties: objectProperties,
      data: dataConfiguration,
    },
    ext: extensionDefinition,
    component() {
      const element = useElement();
      const layout = useLayout();
      const app = useApp();

      // Helper function to extract field name from custom expression
      const extractFieldNameFromExpression = (customExpression) => {
        if (!customExpression) return null;

        // Try to extract field name from expressions like:
        // GetSelectedCount(AccountID)=1
        // GetPossibleCount([automl_feature])=1
        // GetSelectedCount(CustomerName)=1
        const fieldMatch = customExpression.match(
          /Get(?:Selected|Possible)Count\s*\(\s*\[?([^\])\s]+)\]?\s*\)/i
        );
        if (fieldMatch) {
          return fieldMatch[1].trim();
        }
        return null;
      };

      // Alternative validation using hypercube data - fully dynamic based on expression
      const validateUsingHypercubeData = (layout, props) => {
        const customExpression = props.customValidationExpression;
        const customMessage =
          props.customValidationMessage ||
          "Please make the required selections to proceed with AI analysis";

        if (!layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.length) {
          return {
            valid: false,
            message:
              "No data available - please add dimensions to the extension",
            details: [],
            mode: "hypercube_validation",
          };
        }

        const matrix = layout.qHyperCube.qDataPages[0].qMatrix;
        const dimensionInfo = layout.qHyperCube.qDimensionInfo || [];

        // Extract field name from the custom expression dynamically
        let fieldName = extractFieldNameFromExpression(customExpression);

        if (!fieldName) {
          return {
            valid: false,
            message: "Could not extract field name from expression",
            details: [
              {
                label: "Expression Analysis",
                valid: false,
                message: `Unable to parse field name from: ${customExpression}`,
                suggestion:
                  "Use format like GetSelectedCount(FieldName)=1 or GetPossibleCount([FieldName])=1",
              },
            ],
            mode: "hypercube_validation",
          };
        }

        // Look for the specified field in dimensions
        const targetDimIndex = dimensionInfo.findIndex(
          (dim) =>
            dim.qFallbackTitle === fieldName ||
            dim.qFallbackTitle.toLowerCase() === fieldName.toLowerCase()
        );

        if (targetDimIndex === -1) {
          return {
            valid: false,
            message: `Please add '${fieldName}' as a dimension and make a selection`,
            details: [
              {
                label: "Missing Dimension",
                valid: false,
                message: `Field '${fieldName}' not found. Available: ${dimensionInfo
                  .map((d) => d.qFallbackTitle)
                  .join(", ")}`,
                suggestion: `Add '${fieldName}' as a dimension to the extension, or check your expression spelling`,
                fieldName: fieldName, // Keep the field name for error display
              },
            ],
            mode: "hypercube_validation",
          };
        }

        // Check unique values in the target dimension
        const uniqueValues = [
          ...new Set(
            matrix
              .map(
                (row) => row[targetDimIndex]?.qText || row[targetDimIndex]?.qNum
              )
              .filter((val) => val !== null && val !== undefined && val !== "")
          ),
        ];

        const valueCount = uniqueValues.length;

        // Determine if valid based on the expression pattern
        let isValid = false;
        let expectedCount = 1; // default

        // Check if expression specifies =1, >=1, >0, etc.
        if (customExpression.includes("=1")) {
          expectedCount = 1;
          isValid = valueCount === 1;
        } else if (
          customExpression.includes(">=1") ||
          customExpression.includes(">0")
        ) {
          expectedCount = "1 or more";
          isValid = valueCount >= 1;
        } else {
          // Default to exactly 1
          expectedCount = 1;
          isValid = valueCount === 1;
        }

        return {
          valid: isValid,
          message: isValid ? "Selection validation passed" : customMessage,
          details: [
            {
              label: `${fieldName} Selection`,
              valid: isValid,
              message: isValid
                ? `Valid: ${valueCount} value(s) selected from ${fieldName}`
                : `Invalid: ${valueCount} values found in ${fieldName}, expected ${expectedCount}`,
              result: valueCount,
              values: uniqueValues.slice(0, 3),
              dimensionName: dimensionInfo[targetDimIndex]?.qFallbackTitle,
              fieldName: fieldName,
            },
          ],
          mode: "hypercube_validation",
        };
      };

      // Custom expression validation - with fallback to hypercube validation
      const validateCustomExpression = async (layout, props, app) => {
        const customExpression = props.customValidationExpression;
        const customMessage =
          props.customValidationMessage ||
          "Please make the required selections to proceed with AI analysis";

        if (!customExpression || customExpression.trim() === "") {
          return {
            valid: false,
            message: "Custom validation expression not configured",
            details: [],
            mode: "custom_expression",
          };
        }

        try {
          // Debug: Log the expression being evaluated
          console.log("Evaluating expression:", customExpression);

          // Evaluate the custom expression with current data state
          const result = await app.evaluate({
            qExpression: customExpression,
          });

          // Debug: Log the result
          console.log("Expression result:", result);

          // Get the actual result value - handle both qNum and qText
          let resultValue = result?.qNum;
          if (resultValue === undefined || resultValue === null) {
            resultValue = result?.qText;
          }

          // For debugging, also try to parse text as number
          if (typeof resultValue === "string" && !isNaN(resultValue)) {
            resultValue = parseInt(resultValue);
          }

          console.log("Parsed result value:", resultValue, typeof resultValue);

          // If result is -1 or undefined, fall back to hypercube validation
          if (
            resultValue === -1 ||
            resultValue === undefined ||
            resultValue === null
          ) {
            console.log(
              "Expression evaluation failed, falling back to hypercube validation"
            );
            return validateUsingHypercubeData(layout, props);
          }

          // Consider it valid if result is exactly 1
          const isValid = resultValue === 1 || resultValue === "1";

          console.log(
            "Validation result:",
            isValid,
            "from value:",
            resultValue
          );

          return {
            valid: isValid,
            message: isValid ? "Selection validation passed" : customMessage,
            details: [
              {
                label: "Custom Expression",
                valid: isValid,
                message: isValid
                  ? `Expression result: ${resultValue} (Valid)`
                  : `Expression result: ${resultValue} (Invalid - expected 1)`,
                expression: customExpression,
                result: resultValue,
                fieldName: extractFieldNameFromExpression(customExpression), // Add field name extraction
                suggestion:
                  resultValue === 0
                    ? "Make a selection in the filter to get result = 1"
                    : "",
              },
            ],
            mode: "custom_expression",
          };
        } catch (error) {
          console.error("Validation expression error:", error);
          console.log(
            "Expression evaluation failed, falling back to hypercube validation"
          );
          return validateUsingHypercubeData(layout, props);
        }
      };

      // Fallback validation for when custom validation is disabled
      const validateBasicSelection = (layout) => {
        // When custom validation is disabled, require user to enable it first
        return {
          valid: false,
          message:
            "Please enable custom selection validation and configure validation rules",
          mode: "basic",
          requiresValidationSetup: true,
        };
      };

      // Main validation function
      const validateSelections = async (layout, app) => {
        const props = layout?.props || {};

        // If custom validation is enabled, use custom expression
        if (props.enableCustomValidation) {
          return await validateCustomExpression(layout, props, app);
        } else {
          // Basic validation - just check if data exists
          return validateBasicSelection(layout);
        }
      };

      // Enhanced dynamic info for header - extract field from expression dynamically
      const getDynamicSelectionInfo = (layout, validationResult) => {
        if (!validationResult.valid) {
          return "";
        }

        const matrix = layout.qHyperCube.qDataPages[0].qMatrix;
        const dimensionInfo = layout.qHyperCube.qDimensionInfo || [];

        if (matrix.length === 0 || dimensionInfo.length === 0) {
          return "";
        }

        let infoStrings = [];

        // If we have validation details with field info, use that
        if (
          validationResult.details &&
          validationResult.details[0]?.fieldName
        ) {
          const fieldName = validationResult.details[0].fieldName;
          const dimIndex = dimensionInfo.findIndex(
            (dim) =>
              dim.qFallbackTitle === fieldName ||
              dim.qFallbackTitle.toLowerCase() === fieldName.toLowerCase()
          );

          if (dimIndex !== -1) {
            const value =
              matrix[0][dimIndex]?.qText || matrix[0][dimIndex]?.qNum;
            if (value) {
              infoStrings.push(`${fieldName}: ${value}`);
            }
          }
        } else {
          // Fallback: try to find AccountID or similar
          const accountIdIndex = dimensionInfo.findIndex(
            (dim) =>
              dim.qFallbackTitle.toLowerCase().includes("account") ||
              dim.qFallbackTitle === "AccountID"
          );

          if (accountIdIndex !== -1) {
            const accountValue =
              matrix[0][accountIdIndex]?.qText ||
              matrix[0][accountIdIndex]?.qNum;
            if (accountValue) {
              infoStrings.push(`Account: ${accountValue}`);
            }
          }
        }

        // Look for Risk/Churn prediction (optional secondary info)
        const riskIndex = dimensionInfo.findIndex((dim) => {
          const title = dim.qFallbackTitle.toLowerCase();
          return (
            title.includes("risk") ||
            title.includes("churn") ||
            title.includes("predict")
          );
        });

        if (riskIndex !== -1) {
          const riskValue =
            matrix[0][riskIndex]?.qText || matrix[0][riskIndex]?.qNum;
          if (riskValue) {
            infoStrings.push(`Risk: ${riskValue}`);
          }
        }

        return infoStrings.join(" | ");
      };

      // Dynamic field replacement function - works with any fields
      const replaceDynamicFields = (promptText, layout) => {
        if (!layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.length) {
          return promptText;
        }

        const matrix = layout.qHyperCube.qDataPages[0].qMatrix;
        const dimensionInfo = layout.qHyperCube.qDimensionInfo || [];
        const measureInfo = layout.qHyperCube.qMeasureInfo || [];

        // Create field mappings dynamically
        const fieldMap = {};

        // Add dimensions
        dimensionInfo.forEach((dim, index) => {
          const fieldName = dim.qFallbackTitle.toLowerCase();
          const values = matrix
            .map((row) => row[index]?.qText || row[index]?.qNum || "")
            .filter((v) => v !== "");
          const uniqueValues = [...new Set(values)];
          fieldMap[fieldName] = uniqueValues.slice(0, 5).join(", ");
        });

        // Add measures
        measureInfo.forEach((measure, index) => {
          const fieldName = measure.qFallbackTitle.toLowerCase();
          const dimCount = dimensionInfo.length;
          const values = matrix.map((row) => {
            const val =
              row[dimCount + index]?.qNum || row[dimCount + index]?.qText || 0;
            return parseFloat(val) || 0;
          });
          fieldMap[fieldName] = values
            .slice(0, 5)
            .map((v) => v.toString())
            .join(", ");
        });

        // Replace field placeholders - support both {field} and {{field}}
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

      // Validation error display
      const generateValidationErrorHTML = (validationResult, props) => {
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
          word-wrap: break-word;
          overflow-wrap: break-word;
        `;

        // Extract field name from validation details for dynamic messaging
        const getFieldNameFromValidation = (validationResult) => {
          if (
            validationResult.details &&
            validationResult.details[0]?.fieldName
          ) {
            return validationResult.details[0].fieldName;
          }
          return null;
        };

        // Generate dynamic error message based on field name
        const getDynamicErrorMessage = (validationResult) => {
          const fieldName = getFieldNameFromValidation(validationResult);
          if (fieldName) {
            return `Please make the required selection in <strong>${fieldName}</strong> to proceed with AI analysis`;
          }
          return (
            validationResult.message ||
            "Please make the required selections to proceed with AI analysis"
          );
        };

        if (validationResult.mode === "custom_expression") {
          const fieldName = getFieldNameFromValidation(validationResult);
          const dynamicMessage = getDynamicErrorMessage(validationResult);

          return `
            <div style="
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              ${responseStyle}
              text-align: center;
              min-height: 150px;
              max-height: 350px;
              border-color: #ffeaa7;
              background: #fff3cd;
              color: #856404;
            ">
              <div style="max-width: 450px; padding: 20px;">
                <div style="font-size: 24px; margin-bottom: 8px;"></div>
                <h3 style="margin: 0 0 8px 0; color: inherit; font-size: 16px;">Selection Required</h3>
                <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.4;">
                  ${dynamicMessage}
                </p>
                
                <div style="
                  background: rgba(133, 100, 4, 0.1);
                  border-radius: 8px;
                  padding: 12px;
                  margin: 12px 0;
                  text-align: left;
                ">
                  <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px;">🔍 Validation Rule:</div>
                  <div style="font-size: 11px; font-family: monospace; background: rgba(0,0,0,0.1); padding: 6px 8px; border-radius: 4px; word-break: break-all; line-height: 1.3;">
                    ${
                      validationResult.details[0]?.expression ||
                      "Custom expression"
                    }
                  </div>
                  ${
                    validationResult.details[0]?.result !== undefined
                      ? `
                    <div style="font-size: 11px; margin-top: 6px;">
                      <strong>Result:</strong> ${
                        validationResult.details[0].result
                      } 
                      ${
                        validationResult.details[0]?.error
                          ? `<br><strong>Error:</strong> ${validationResult.details[0].error}`
                          : ""
                      }
                      ${
                        validationResult.details[0]?.suggestion
                          ? `<br><strong>💡 Suggestion:</strong> ${validationResult.details[0].suggestion}`
                          : ""
                      }
                    </div>
                  `
                      : ""
                  }
                </div>
                
                <div style="
                  background: #e3f2fd;
                  border: 1px solid #90caf9;
                  border-radius: 8px;
                  padding: 12px;
                  margin-top: 12px;
                  font-size: 11px;
                  color: #1565c0;
                  text-align: left;
                  line-height: 1.3;
                ">
                  <div style="font-weight: 600; margin-bottom: 6px;">💡 How to fix:</div>
                  <div>
                    ${
                      fieldName
                        ? `Make a selection in <strong>${fieldName}</strong> to satisfy the validation expression above. The AI analysis will become available once the condition is met.`
                        : `Make the required selections in your app to satisfy the validation expression above. The AI analysis will become available once all conditions are met.`
                    }
                  </div>
                </div>
              </div>
            </div>
          `;
        }

        // For hypercube validation errors
        if (validationResult.mode === "hypercube_validation") {
          const fieldName = getFieldNameFromValidation(validationResult);
          const dynamicMessage = getDynamicErrorMessage(validationResult);

          return `
            <div style="
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              ${responseStyle}
              text-align: center;
              min-height: 150px;
              max-height: 350px;
              border-color: #ffeaa7;
              background: #fff3cd;
              color: #856404;
            ">
              <div style="max-width: 450px; padding: 20px;">
                <div style="font-size: 24px; margin-bottom: 8px;"></div>
                <h3 style="margin: 0 0 8px 0; color: inherit; font-size: 16px;">Selection Required</h3>
                <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.4;">
                  ${dynamicMessage}
                </p>
                
                ${
                  validationResult.details && validationResult.details[0]
                    ? `
                `
                    : ""
                }
                
                <div style="
                  background: #e3f2fd;
                  border: 1px solid #90caf9;
                  border-radius: 8px;
                  padding: 12px;
                  margin-top: 12px;
                  font-size: 11px;
                  color: #1565c0;
                  text-align: left;
                  line-height: 1.3;
                ">
                  <div style="font-weight: 600; margin-bottom: 6px;">💡 How to select:</div>
                  <div>
                    ${
                      fieldName
                        ? `• Use the filters to make a selection in <strong>${fieldName}</strong><br>• Check that only one value is selected<br>• Ensure the selection satisfies the validation condition`
                        : `• Use the filters to make the required selections<br>• Check the validation rule for specific requirements<br>• Make sure your selections satisfy the conditions`
                    }
                  </div>
                </div>
              </div>
            </div>
          `;
        }

        // Basic validation error for when custom validation is disabled
        if (validationResult.requiresValidationSetup) {
          return `
            <div style="
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              ${responseStyle}
              text-align: center;
              min-height: 150px;
              max-height: 350px;
              border-color: #ffeaa7;
              background: #fff3cd;
              color: #856404;
            ">
              <div style="max-width: 400px; padding: 20px;">
                <div style="font-size: 24px; margin-bottom: 8px;">⚙️</div>
                <h3 style="margin: 0 0 8px 0; color: inherit; font-size: 16px;">Validation Setup Required</h3>
                <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.4;">
                  Please enable custom selection validation and configure validation rules to use AI analysis
                </p>
                
                <div style="
                  background: #e3f2fd;
                  border: 1px solid #90caf9;
                  border-radius: 8px;
                  padding: 12px;
                  margin-top: 12px;
                  font-size: 11px;
                  color: #1565c0;
                  text-align: left;
                  line-height: 1.3;
                ">
                  <div style="font-weight: 600; margin-bottom: 6px;">💡 Setup steps:</div>
                  <div>
                    1. Check "Enable Custom Selection Validation"<br>
                    2. Add validation expression (e.g., GetSelectedCount(AccountID)=1)<br>
                    3. Configure custom error message<br>
                    4. Save and make your selections to enable AI analysis
                  </div>
                </div>
              </div>
            </div>
          `;
        }

        // Default fallback error
        const fieldName = getFieldNameFromValidation(validationResult);
        const dynamicMessage = getDynamicErrorMessage(validationResult);

        return `
          <div style="
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            ${responseStyle}
            text-align: center;
            min-height: 150px;
            max-height: 350px;
            border-color: #ffeaa7;
            background: #fff3cd;
            color: #856404;
          ">
            <div style="max-width: 350px; padding: 20px;">
              <div style="font-size: 24px; margin-bottom: 8px;"></div>
              <h3 style="margin: 0 0 8px 0; color: inherit; font-size: 16px;">Selection Required</h3>
              <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.4;">
                ${dynamicMessage}
              </p>
              
              <div style="
                background: #e3f2fd;
                border: 1px solid #90caf9;
                border-radius: 8px;
                padding: 12px;
                margin-top: 12px;
                font-size: 11px;
                color: #1565c0;
                text-align: left;
                line-height: 1.3;
              ">
                <div style="font-weight: 600; margin-bottom: 6px;">💡 How to select:</div>
                <div>
                  ${
                    fieldName
                      ? `• Use the filters to make a selection in <strong>${fieldName}</strong><br>• Check the validation rule for specific requirements<br>• Make sure your selections satisfy the conditions`
                      : `• Use the filters to make the required selections<br>• Check the validation rule for specific requirements<br>• Make sure your selections satisfy the conditions`
                  }
                </div>
              </div>
            </div>
          </div>
        `;
      };

      // Main effect hook - Re-run when layout changes (selections, filters, etc.)
      useEffect(() => {
        if (!element) return;

        const render = async () => {
          const props = layout?.props || {};

          // Get validation result
          const validation = await validateSelections(layout, app);
          const selectionInfo = getDynamicSelectionInfo(layout, validation);

          // Apply custom styling
          const headerStyle = `
            background: ${props.headerBackgroundColor || "#ffffff"};
            color: ${props.headerTextColor || "#1a1a1a"};
            padding: ${Math.max(8, (props.padding || 15) - 7)}px;
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
            word-wrap: break-word;
            overflow-wrap: break-word;
          `;

          const buttonStyle = `
            background: linear-gradient(135deg, ${
              props.buttonBackgroundColor || "#667eea"
            } 0%, ${props.buttonBackgroundColor || "#764ba2"} 100%);
            color: ${props.buttonTextColor || "#ffffff"};
            border-radius: ${props.borderRadius || 8}px;
            padding: 10px 16px;
            font-size: ${Math.max(12, (props.fontSize || 14) - 1)}px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
          `;

          // Build header
          let content = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; background: #ffffff; min-height: 200px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0; ${headerStyle} flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
                  <span style="font-size: 20px; margin-right: 8px; flex-shrink: 0;">🤖</span>
                  <div style="min-width: 0; flex: 1;">
                    <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">AI Analysis</h2>
                    ${
                      selectionInfo
                        ? `<p style="margin: 2px 0 0 0; font-size: 12px; opacity: 0.7; color: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${selectionInfo}</p>`
                        : ""
                    }
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          `;

          // Add button based on configuration and validation state
          if (
            !props.connectionName ||
            !props.systemPrompt ||
            !props.userPrompt
          ) {
            content += `
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 6px 10px; font-size: 11px; color: #856404; white-space: nowrap;">
                ⚙️ Configuration Required
              </div>
            `;
          } else if (!validation.valid) {
            content += `
              <button disabled style="background: #e9ecef; color: #6c757d; border-radius: ${
                props.borderRadius || 8
              }px; padding: 8px 12px; font-size: 11px; font-weight: 600; border: none; cursor: not-allowed; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                <span>⚠️</span>
                Selection Required
              </button>
            `;
          } else {
            content += `
              <button id="generateButton" style="${buttonStyle} box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3); display: flex; align-items: center; gap: 4px;">
                <span style="font-size: 14px;">✨</span>
                <span>Generate Analysis</span>
              </button>
            `;
          }

          content += `</div></div>`;

          // Main content area
          if (
            !props.connectionName ||
            !props.systemPrompt ||
            !props.userPrompt
          ) {
            // Configuration needed
            const missingItems = [];
            if (!props.connectionName) missingItems.push("Connection Name");
            if (!props.systemPrompt) missingItems.push("System Prompt");
            if (!props.userPrompt) missingItems.push("User Prompt");

            content += `
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 12px; text-align: center; color: #6c757d; padding: 20px; min-height: 150px;">
                <div style="max-width: 400px;">
                  <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.3;">⚙️</div>
                  <h3 style="margin: 0 0 6px 0; color: #495057; font-size: 16px;">Configuration Required</h3>
                  <p style="margin: 0 0 8px 0; font-size: 13px;">Please configure the following in the properties panel:</p>
                  <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 500; color: #dc3545;">${missingItems.join(
                    ", "
                  )}</p>
                  
                  <div style="background: #e3f2fd; border: 1px solid #90caf9; border-radius: 8px; padding: 10px 12px; margin-top: 12px; font-size: 11px; color: #1565c0; text-align: left; line-height: 1.3;">
                    <div style="font-weight: 600; margin-bottom: 4px;">💡 Quick Setup:</div>
                    <div>
                      • Set your Claude SSE connection name<br>
                      • Add system and user prompts with {{fieldName}} placeholders<br>
                      • Enable custom validation with GetPossibleCount() expressions<br>
                      • Use any field names from your data model
                    </div>
                  </div>
                </div>
              </div>
            `;
          } else {
            // Show main interface
            content += `<div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">`;

            if (!validation.valid) {
              content += generateValidationErrorHTML(validation, props);
            } else {
              // Ready state
              content += `
                <div id="llmResponse" style="flex: 1; overflow-y: scroll; ${responseStyle} text-align: left; min-height: 180px; height: 280px; border: 1px solid #d4edda; background: #f8fff9; scrollbar-width: thin; scrollbar-color: #9ca3af #f1f3f4;">
                  <div style="padding: 16px; color: #155724; text-align: center;">
                    <h3 style="margin: 0 0 6px 0; color: inherit; font-size: 16px; font-weight: 600;">Ready to Analyze</h3>
                    <div style="background: rgba(21, 87, 36, 0.1); border-radius: 16px; padding: 6px 12px; margin: 6px auto 12px auto; font-size: 13px; font-weight: 500; display: inline-block;">
                      ${
                        validation.mode === "custom_expression"
                          ? "Custom validation passed"
                          : "Data ready"
                      }
                    </div>
                    <p style="margin: 0; opacity: 0.8; font-size: 13px; line-height: 1.4;">
                      Ready to analyze the selected data<br>
                      <span style="font-size: 11px; opacity: 0.7;">Click the generate button above to start AI analysis</span>
                    </p>
                  </div>
                </div>
              `;
            }

            content += `</div>`;
          }

          content += `</div>`;

          // Set HTML and add styles
          element.innerHTML = content;

          // Add CSS
          const style = document.createElement("style");
          style.textContent = `
            #generateButton:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5) !important;
            }
            
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            
            #llmResponse::-webkit-scrollbar {
              width: 12px;
            }
            #llmResponse::-webkit-scrollbar-track {
              background: #f1f3f4;
              border-radius: 6px;
              margin: 4px;
            }
            #llmResponse::-webkit-scrollbar-thumb {
              background: #9ca3af;
              border-radius: 6px;
              border: 2px solid #f1f3f4;
            }
            #llmResponse::-webkit-scrollbar-thumb:hover {
              background: #6b7280;
            }
          `;
          document.head.appendChild(style);

          // Generate button handler
          const handleGenerate = async () => {
            const validation = await validateSelections(layout, app);
            const responseDiv = element.querySelector("#llmResponse");
            const generateButton = element.querySelector("#generateButton");

            if (!validation.valid) {
              if (responseDiv) {
                responseDiv.innerHTML = generateValidationErrorHTML(
                  validation,
                  props
                );
              }
              return;
            }

            // Disable button and show loading
            if (generateButton) {
              generateButton.disabled = true;
              generateButton.style.background =
                "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)";
              generateButton.innerHTML = `<span style="margin-right: 6px;">⏳</span><span>Analyzing...</span>`;
            }

            if (responseDiv) {
              responseDiv.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; color: #6c757d; padding: 20px; text-align: center;">
                  <div style="width: 24px; height: 24px; border: 3px solid #f3f3f3; border-top: 3px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 12px;"></div>
                  <p style="margin: 0; font-size: 14px;">Analyzing your data...</p>
                  <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.7;">Processing with Claude AI</p>
                </div>
              `;
            }

            try {
              // Get and process prompts
              let systemPrompt = props.systemPrompt || "";
              let userPrompt = props.userPrompt || "";

              // Replace dynamic fields
              systemPrompt = replaceDynamicFields(systemPrompt, layout);
              userPrompt = replaceDynamicFields(userPrompt, layout);

              let fullPrompt = userPrompt;
              if (systemPrompt) {
                fullPrompt = systemPrompt + "\n\n" + userPrompt;
              }

              // Add data context if available
              if (layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.length > 0) {
                fullPrompt += "\n\nData Context:\n";
                const matrix = layout.qHyperCube.qDataPages[0].qMatrix;

                // Add headers
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

                // Add data rows
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

              // Escape for JSON
              const escapedPrompt = fullPrompt
                .replace(/\\/g, "\\\\")
                .replace(/"/g, '\\"')
                .replace(/'/g, "\\'")
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r");

              // Build expression
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

              // Execute
              const response = await app.evaluate({ qExpression: expression });
              const responseText =
                response?.qText || response || "No response received";

              // Display result
              if (responseDiv) {
                responseDiv.innerHTML = `
                  <div style="word-wrap: break-word; line-height: 1.6; text-align: left; padding: 12px; overflow-y: scroll; height: 220px; scrollbar-width: thin; scrollbar-color: #9ca3af #f1f3f4;" class="analysis-content">
                    <div style="white-space: pre-wrap;">${responseText.replace(
                      /\n/g,
                      "<br>"
                    )}</div>
                  </div>
                `;
              }
            } catch (err) {
              console.error("LLM Error:", err);

              if (responseDiv) {
                responseDiv.innerHTML = `
                  <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 12px; color: #dc2626; text-align: left; line-height: 1.5; font-size: 13px; word-wrap: break-word; overflow-wrap: break-word;">
                    <div style="font-weight: 600; margin-bottom: 4px;">⚠️ Error</div>
                    ${err.message || "Failed to generate response"}
                    <div style="margin-top: 8px; font-size: 11px; opacity: 0.8;">
                      Check your connection name and ensure the Claude SSE endpoint is properly configured.
                    </div>
                  </div>
                `;
              }
            } finally {
              // Complete button state
              if (generateButton) {
                generateButton.disabled = true;
                generateButton.style.background = "#e9ecef";
                generateButton.style.color = "#6c757d";
                generateButton.style.cursor = "not-allowed";
                generateButton.style.boxShadow = "none";
                generateButton.innerHTML =
                  '<span style="font-size: 14px;"></span><span>Analysis Complete</span>';
              }
            }
          };

          // Add event listener
          const generateButton = element.querySelector("#generateButton");
          if (generateButton) {
            generateButton.onclick = handleGenerate;
          }
        };

        render();
      }, [element, layout, app]); // This will re-run whenever layout changes (including filter selections)
    },
  };
}
