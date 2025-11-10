#!/bin/bash

###############################################################################
# Load Sample Payroll Data into DynamoDB
#
# This script loads sample personnel and payroll entry data for testing.
#
# Usage:
#   ./load-sample-payroll-data.sh [--region us-east-1] [--profile default]
###############################################################################

set -e

# Default values
REGION="us-east-1"
PROFILE="default"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --region)
      REGION="$2"
      shift 2
      ;;
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [--region REGION] [--profile PROFILE]"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

AWS_CMD="aws --region $REGION --profile $PROFILE"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Loading Sample Payroll Data${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

###############################################################################
# Load Personnel Profiles
###############################################################################
echo -e "${YELLOW}Loading personnel profiles...${NC}"

# Bob Johnson
$AWS_CMD dynamodb put-item --table-name sitelogix-personnel --item '{
  "PK": {"S": "PERSON#550e8400-e29b-41d4-a716-446655440000"},
  "SK": {"S": "PROFILE"},
  "entity_type": {"S": "PERSON_PROFILE"},
  "person_id": {"S": "550e8400-e29b-41d4-a716-446655440000"},
  "employee_number": {"S": "EMP-001"},
  "first_name": {"S": "Robert"},
  "last_name": {"S": "Johnson"},
  "full_name": {"S": "Robert Johnson"},
  "preferred_name": {"S": "Bob"},
  "email": {"S": "bob.johnson@example.com"},
  "phone": {"S": "+1-555-123-4567"},
  "hire_date": {"S": "2024-01-15"},
  "employment_status": {"S": "active"},
  "job_title": {"S": "Lead Carpenter"},
  "default_hourly_rate": {"N": "35.00"},
  "default_overtime_rate": {"N": "52.50"},
  "known_aliases": {"SS": ["Bob", "Bobby", "Robert", "Bob Johnson"]},
  "first_mentioned_date": {"S": "2024-09-18"},
  "last_seen_date": {"S": "2025-01-06"},
  "total_reports_count": {"N": "47"},
  "total_hours_worked": {"N": "376.5"},
  "needs_profile_completion": {"BOOL": false},
  "created_by_user_id": {"S": "mgr_001"},
  "created_at": {"S": "2024-09-18T14:30:00Z"},
  "updated_at": {"S": "2025-01-06T16:45:00Z"}
}'

echo -e "${GREEN}✓ Loaded Robert Johnson (Bob)${NC}"

# Mike Anderson
$AWS_CMD dynamodb put-item --table-name sitelogix-personnel --item '{
  "PK": {"S": "PERSON#660e8400-e29b-41d4-a716-446655440001"},
  "SK": {"S": "PROFILE"},
  "entity_type": {"S": "PERSON_PROFILE"},
  "person_id": {"S": "660e8400-e29b-41d4-a716-446655440001"},
  "employee_number": {"S": "EMP-002"},
  "first_name": {"S": "Michael"},
  "last_name": {"S": "Anderson"},
  "full_name": {"S": "Michael Anderson"},
  "preferred_name": {"S": "Mike"},
  "email": {"S": "mike.anderson@example.com"},
  "phone": {"S": "+1-555-234-5678"},
  "hire_date": {"S": "2023-06-01"},
  "employment_status": {"S": "active"},
  "job_title": {"S": "Electrician"},
  "default_hourly_rate": {"N": "32.00"},
  "default_overtime_rate": {"N": "48.00"},
  "known_aliases": {"SS": ["Mike", "Michael", "Mike Anderson"]},
  "first_mentioned_date": {"S": "2024-09-19"},
  "last_seen_date": {"S": "2025-01-06"},
  "total_reports_count": {"N": "52"},
  "total_hours_worked": {"N": "416.0"},
  "needs_profile_completion": {"BOOL": false},
  "created_by_user_id": {"S": "mgr_001"},
  "created_at": {"S": "2024-09-19T08:15:00Z"},
  "updated_at": {"S": "2025-01-06T16:45:00Z"}
}'

echo -e "${GREEN}✓ Loaded Michael Anderson (Mike)${NC}"

# Sarah Martinez
$AWS_CMD dynamodb put-item --table-name sitelogix-personnel --item '{
  "PK": {"S": "PERSON#770e8400-e29b-41d4-a716-446655440002"},
  "SK": {"S": "PROFILE"},
  "entity_type": {"S": "PERSON_PROFILE"},
  "person_id": {"S": "770e8400-e29b-41d4-a716-446655440002"},
  "employee_number": {"S": "EMP-003"},
  "first_name": {"S": "Sarah"},
  "last_name": {"S": "Martinez"},
  "full_name": {"S": "Sarah Martinez"},
  "preferred_name": {"S": "Sarah"},
  "email": {"S": "sarah.martinez@example.com"},
  "phone": {"S": "+1-555-345-6789"},
  "hire_date": {"S": "2024-03-10"},
  "employment_status": {"S": "active"},
  "job_title": {"S": "Plumber"},
  "default_hourly_rate": {"N": "33.00"},
  "default_overtime_rate": {"N": "49.50"},
  "known_aliases": {"SS": ["Sarah", "Sarah Martinez"]},
  "first_mentioned_date": {"S": "2024-09-20"},
  "last_seen_date": {"S": "2025-01-05"},
  "total_reports_count": {"N": "38"},
  "total_hours_worked": {"N": "304.0"},
  "needs_profile_completion": {"BOOL": false},
  "created_by_user_id": {"S": "mgr_001"},
  "created_at": {"S": "2024-09-20T10:00:00Z"},
  "updated_at": {"S": "2025-01-05T15:30:00Z"}
}'

echo -e "${GREEN}✓ Loaded Sarah Martinez${NC}"

###############################################################################
# Load Personnel Aliases
###############################################################################
echo ""
echo -e "${YELLOW}Loading personnel aliases...${NC}"

# Bob aliases
$AWS_CMD dynamodb put-item --table-name sitelogix-personnel --item '{
  "PK": {"S": "PERSON#550e8400-e29b-41d4-a716-446655440000"},
  "SK": {"S": "ALIAS#bob"},
  "entity_type": {"S": "PERSON_ALIAS"},
  "person_id": {"S": "550e8400-e29b-41d4-a716-446655440000"},
  "alias_name": {"S": "bob"},
  "full_name": {"S": "Robert Johnson"},
  "created_at": {"S": "2024-09-18T14:30:00Z"}
}'

$AWS_CMD dynamodb put-item --table-name sitelogix-personnel --item '{
  "PK": {"S": "PERSON#550e8400-e29b-41d4-a716-446655440000"},
  "SK": {"S": "ALIAS#bobby"},
  "entity_type": {"S": "PERSON_ALIAS"},
  "person_id": {"S": "550e8400-e29b-41d4-a716-446655440000"},
  "alias_name": {"S": "bobby"},
  "full_name": {"S": "Robert Johnson"},
  "created_at": {"S": "2024-09-18T14:30:00Z"}
}'

echo -e "${GREEN}✓ Loaded Bob/Bobby aliases${NC}"

# Mike aliases
$AWS_CMD dynamodb put-item --table-name sitelogix-personnel --item '{
  "PK": {"S": "PERSON#660e8400-e29b-41d4-a716-446655440001"},
  "SK": {"S": "ALIAS#mike"},
  "entity_type": {"S": "PERSON_ALIAS"},
  "person_id": {"S": "660e8400-e29b-41d4-a716-446655440001"},
  "alias_name": {"S": "mike"},
  "full_name": {"S": "Michael Anderson"},
  "created_at": {"S": "2024-09-19T08:15:00Z"}
}'

echo -e "${GREEN}✓ Loaded Mike alias${NC}"

###############################################################################
# Load Payroll Entries
###############################################################################
echo ""
echo -e "${YELLOW}Loading payroll entries...${NC}"

# Bob's entry
$AWS_CMD dynamodb put-item --table-name sitelogix-payroll-entries --item '{
  "PK": {"S": "REPORT#rpt_20250106_mgr_001_1736179200"},
  "SK": {"S": "ENTRY#550e8400-e29b-41d4-a716-446655440000#1736179200000"},
  "entity_type": {"S": "PAYROLL_ENTRY"},
  "entry_id": {"S": "pay_20250106_rpt_001_emp_001"},
  "report_id": {"S": "rpt_20250106_mgr_001_1736179200"},
  "report_date": {"S": "2025-01-06"},
  "project_id": {"S": "proj_riverside_tower"},
  "project_name": {"S": "Riverside Tower Apartments"},
  "employee_id": {"S": "550e8400-e29b-41d4-a716-446655440000"},
  "employee_number": {"S": "EMP-001"},
  "employee_name": {"S": "Robert Johnson"},
  "arrival_time": {"S": "07:00"},
  "departure_time": {"S": "16:00"},
  "regular_hours": {"N": "8.0"},
  "overtime_hours": {"N": "1.0"},
  "total_hours": {"N": "9.0"},
  "hourly_rate": {"N": "35.00"},
  "overtime_rate": {"N": "52.50"},
  "total_cost": {"N": "332.50"},
  "extracted_by_ai": {"BOOL": true},
  "needs_review": {"S": "false"},
  "created_at": {"S": "2025-01-06T17:30:00Z"}
}'

echo -e "${GREEN}✓ Loaded Bob payroll entry${NC}"

# Mike's entry
$AWS_CMD dynamodb put-item --table-name sitelogix-payroll-entries --item '{
  "PK": {"S": "REPORT#rpt_20250106_mgr_001_1736179200"},
  "SK": {"S": "ENTRY#660e8400-e29b-41d4-a716-446655440001#1736179200001"},
  "entity_type": {"S": "PAYROLL_ENTRY"},
  "entry_id": {"S": "pay_20250106_rpt_001_emp_002"},
  "report_id": {"S": "rpt_20250106_mgr_001_1736179200"},
  "report_date": {"S": "2025-01-06"},
  "project_id": {"S": "proj_riverside_tower"},
  "project_name": {"S": "Riverside Tower Apartments"},
  "employee_id": {"S": "660e8400-e29b-41d4-a716-446655440001"},
  "employee_number": {"S": "EMP-002"},
  "employee_name": {"S": "Michael Anderson"},
  "arrival_time": {"S": "07:30"},
  "departure_time": {"S": "15:30"},
  "regular_hours": {"N": "8.0"},
  "overtime_hours": {"N": "0.0"},
  "total_hours": {"N": "8.0"},
  "hourly_rate": {"N": "32.00"},
  "overtime_rate": {"N": "48.00"},
  "total_cost": {"N": "256.00"},
  "extracted_by_ai": {"BOOL": true},
  "needs_review": {"S": "false"},
  "created_at": {"S": "2025-01-06T17:30:00Z"}
}'

echo -e "${GREEN}✓ Loaded Mike payroll entry${NC}"

# Sarah's entry
$AWS_CMD dynamodb put-item --table-name sitelogix-payroll-entries --item '{
  "PK": {"S": "REPORT#rpt_20250106_mgr_001_1736179200"},
  "SK": {"S": "ENTRY#770e8400-e29b-41d4-a716-446655440002#1736179200002"},
  "entity_type": {"S": "PAYROLL_ENTRY"},
  "entry_id": {"S": "pay_20250106_rpt_001_emp_003"},
  "report_id": {"S": "rpt_20250106_mgr_001_1736179200"},
  "report_date": {"S": "2025-01-06"},
  "project_id": {"S": "proj_riverside_tower"},
  "project_name": {"S": "Riverside Tower Apartments"},
  "employee_id": {"S": "770e8400-e29b-41d4-a716-446655440002"},
  "employee_number": {"S": "EMP-003"},
  "employee_name": {"S": "Sarah Martinez"},
  "arrival_time": {"S": "07:00"},
  "departure_time": {"S": "15:00"},
  "regular_hours": {"N": "8.0"},
  "overtime_hours": {"N": "0.0"},
  "total_hours": {"N": "8.0"},
  "hourly_rate": {"N": "33.00"},
  "overtime_rate": {"N": "49.50"},
  "total_cost": {"N": "264.00"},
  "extracted_by_ai": {"BOOL": true},
  "needs_review": {"S": "false"},
  "created_at": {"S": "2025-01-06T17:30:00Z"}
}'

echo -e "${GREEN}✓ Loaded Sarah payroll entry${NC}"

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}Sample data loaded successfully!${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "You can now query the data:"
echo ""
echo "# Get all personnel:"
echo "aws dynamodb scan --table-name sitelogix-personnel --filter-expression \"SK = :sk\" --expression-attribute-values '{\":sk\":{\"S\":\"PROFILE\"}}'"
echo ""
echo "# Get payroll entries for Jan 6:"
echo "aws dynamodb query --table-name sitelogix-payroll-entries --index-name GSI3-DateIndex --key-condition-expression \"report_date = :date\" --expression-attribute-values '{\":date\":{\"S\":\"2025-01-06\"}}'"
echo ""
echo "# Search for employee by alias:"
echo "aws dynamodb query --table-name sitelogix-personnel --key-condition-expression \"PK = :pk AND begins_with(SK, :sk)\" --expression-attribute-values '{\":pk\":{\"S\":\"PERSON#550e8400-e29b-41d4-a716-446655440000\"},\":sk\":{\"S\":\"ALIAS#\"}}'"
echo ""
