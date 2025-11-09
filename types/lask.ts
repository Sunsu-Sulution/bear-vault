export interface ErrorResponse {
    code: number,
    msg: string,
    error: true,
}

export interface PaginatedResponse<T> {
    datas: T[];
    next: number;
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isErrorResponse = (data: any): data is ErrorResponse => {
    return typeof data === "object" && data !== null && (data as { error?: unknown }).error === true;
};

export interface GetUserInfoResponse {
    sub: string;
    name: string;
    picture: string;
    open_id: string;
    en_name: string;
    tenant_key: string;
    avatar_url: string;
    avatar_thumb: string;
    avatar_middle: string;
    avatar_big: string;
    email: string;
    user_id: string;
    employee_no: string;
    mobile: string;
}

export const getInitUserInfo = (): GetUserInfoResponse => {
    return {
        sub: "",
        name: "",
        picture: "",
        open_id: "",
        en_name: "",
        tenant_key: "",
        avatar_url: "",
        avatar_thumb: "",
        avatar_middle: "",
        avatar_big: "",
        email: "",
        user_id: "",
        employee_no: "",
        mobile: ""
    }
}
