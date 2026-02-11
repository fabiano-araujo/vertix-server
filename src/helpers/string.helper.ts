export const isEmpty = (str: string | null) => {
    return str === null || str.trim() === "";
}
export const isNotEmpty = (str: string | null) => {
    return !isEmpty(str);
}