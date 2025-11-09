import axios from "axios";
import { ErrorResponse, GetUserInfoResponse } from "@/types/lask";
import { removeItem } from "./storage";

const handlerError = (
    error: unknown,
    setAlert: (
        message: string,
        type: string,
        action: (() => void) | undefined,
        isOpen: boolean,
    ) => void,
): ErrorResponse => {
    if (axios.isAxiosError(error)) {
        if (
            error.response &&
            error.response.data &&
            (error.response.data as { error?: unknown }).error
        ) {
            const responseData = error.response.data as { code?: number; msg?: string };
            if (responseData.code === 99991400) {
                return {
                    code: 99991400,
                    msg: "Rate limit exceeded, retrying...",
                    error: true,
                };
            }
            setAlert("เกิดข้อผิดพลาด", responseData.msg || "Error", () => {
                window.location.href = "/"
            }, false);
            return {
                code: error.response.status || 400,
                msg: responseData.msg || "Error",
                error: true,
            };
        } else {
            setAlert("เกิดข้อผิดพลาด", error.message, () => {
                window.location.href = "/"
            }, false);
            return {
                code: 9999,
                msg: error.message,
                error: true,
            };
        }
    } else {
        console.error(error)
        setAlert("เกิดข้อผิดพลาด", "An unknown error occurred. Try again!", () => {
            window.location.href = "/"
        }, false);
        return {
            code: 9999,
            msg: "An unknow error occurred. try again!",
            error: true,
        };
    }
};

export class BackendClient {
    private readonly setAlert: (
        message: string,
        type: string,
        action: (() => void) | undefined,
        isOpen: boolean,
    ) => void;

    constructor(
        setAlert: (
            message: string,
            type: string,
            action: (() => void) | undefined,
            isOpen: boolean,
        ) => void,
    ) {
        this.setAlert = setAlert;
    }

    getAccessToken = async (code: string): Promise<GetUserInfoResponse | ErrorResponse> => {
        try {
            const response = await axios.get(`/api/authorization?code=${code}`)
            return response.data
        } catch (e) {
            return handlerError(e, this.setAlert)
        }
    }

    logout = () => {
        try {
            removeItem("user_info");
            window.location.href = "/";
        } catch (e) {
            return handlerError(e, this.setAlert)
        }
    }
}
