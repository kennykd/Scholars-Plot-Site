declare module "*.css" {
    const content: { [key: string]: string };
    export default content;
}

declare module "swagger-ui-react" {
    import * as React from "react";

    interface SwaggerUIProps {
        url?: string;
        spec?: Record<string, unknown>;
        [key: string]: unknown;
    }

    const SwaggerUI: React.ComponentType<SwaggerUIProps>;
    export default SwaggerUI;
}