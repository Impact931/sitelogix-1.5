# AWS MCP Server Setup - SiteLogix 1.5

**Date:** October 8, 2025
**Status:** ✅ Configured and Ready

---

## 📦 Installed MCP Servers

The following AWS MCP servers have been configured for this project:

### 1. **AWS API MCP Server** (`aws-api`)
- **Package:** `awslabs.aws-api-mcp-server@latest`
- **Purpose:** Enables AI assistants to interact with AWS services via AWS CLI commands
- **Region:** `us-east-1`
- **Status:** ✅ Installed and tested

### 2. **AWS Lambda MCP Server** (`aws-lambda`)
- **Package:** `awslabs.lambda-mcp-server@latest`
- **Purpose:** Manage and interact with AWS Lambda functions
- **Region:** `us-east-1`
- **Status:** ✅ Configured

### 3. **AWS Knowledge MCP Server** (`aws-knowledge`)
- **Package:** `awslabs.aws-knowledge-mcp-server@latest`
- **Purpose:** Access AWS documentation and best practices
- **Region:** `us-east-1`
- **Status:** ✅ Configured

---

## 📁 Configuration Files

### Project Configuration
**File:** `/Users/jhrstudio/Documents/GitHub/sitelogix-1.5/.mcp.json`

```json
{
  "mcpServers": {
    "aws-api": {
      "command": "uvx",
      "args": ["awslabs.aws-api-mcp-server@latest"],
      "env": {
        "AWS_REGION": "us-east-1"
      }
    },
    "aws-lambda": {
      "command": "uvx",
      "args": ["awslabs.lambda-mcp-server@latest"],
      "env": {
        "AWS_REGION": "us-east-1"
      }
    },
    "aws-knowledge": {
      "command": "uvx",
      "args": ["awslabs.aws-knowledge-mcp-server@latest"],
      "env": {
        "AWS_REGION": "us-east-1"
      }
    }
  }
}
```

---

## 🔧 AWS Credentials

**AWS Account ID:** 500313280221
**Region:** us-east-1
**Profile:** default (root credentials)

### Configured Services:
- ✅ AWS CLI 2.30.1
- ✅ DynamoDB tables (4 tables active)
- ✅ S3 buckets (3 buckets for SiteLogix)
- ✅ Root user credentials configured

---

## 🚀 How to Use MCP Servers

### Activate in Claude Code

**Important:** To activate the MCP servers, you need to **restart Claude Code** or reload the window.

The MCP servers will then be available and you can use them by:

1. Running AWS CLI commands through natural language
2. Querying AWS service information
3. Managing Lambda functions
4. Accessing AWS documentation

### Example Commands via MCP

Once activated, you can ask Claude to:
- "List all Lambda functions in my account"
- "Create a new S3 bucket for audio files"
- "Show me the DynamoDB table schema for sitelogix-reports"
- "What's the best practice for Lambda function memory configuration?"

---

## 🔄 Updating MCP Servers

To update to the latest version:

```bash
# The @latest suffix ensures automatic updates
# No manual update needed - uvx handles this automatically
```

---

## 🐛 Troubleshooting

### MCP Servers Not Connecting

If you see "Failed to connect" errors:

1. **Restart Claude Code** - MCP servers require a restart to initialize
2. **Check uvx installation:**
   ```bash
   which uv
   uvx --version
   ```

3. **Test server manually:**
   ```bash
   uvx awslabs.aws-api-mcp-server@latest --help
   ```

4. **Verify AWS credentials:**
   ```bash
   aws sts get-caller-identity
   ```

### Common Issues

| Issue | Solution |
|-------|----------|
| `Failed to connect` | Restart Claude Code |
| `Package not found` | Check package name: must be `awslabs.aws-api-mcp-server` |
| `AWS credentials error` | Verify `~/.aws/credentials` or environment variables |
| `Region not set` | Check `.mcp.json` has `AWS_REGION` in env |

---

## 📚 Additional Resources

- **AWS MCP GitHub:** https://github.com/awslabs/mcp
- **AWS MCP Documentation:** https://awslabs.github.io/mcp/
- **PyPI Packages:**
  - https://pypi.org/project/awslabs.aws-api-mcp-server/
  - https://pypi.org/project/awslabs.lambda-mcp-server/
  - https://pypi.org/project/awslabs.aws-knowledge-mcp-server/

---

## ✅ Next Steps

1. **Restart Claude Code** to activate MCP servers
2. Test AWS integration with sample commands
3. Begin deploying SiteLogix infrastructure using MCP
4. Use AWS Knowledge MCP for best practices guidance

---

**Setup completed by:** Claude Code
**Configuration scope:** Project-level (shared via .mcp.json)
