export interface Organization {
    id?: string;
    org_name: string;
    org_code: string;
    status?: string;
    integrations?: {
        facebook_page_id?: string;
    };
    config?: {
        max_delegation_depth?: number;
        max_websearch_depth?: number;
    };
    created_at?: string;
    updated_at?: string;
}
