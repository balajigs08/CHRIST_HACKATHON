class CrisisError(Exception):
    """Domain error that maps to a structured HTTP error response."""

    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class NotFound(CrisisError):
    def __init__(self, code: str, message: str):
        super().__init__(404, code, message)


class Conflict(CrisisError):
    def __init__(self, code: str, message: str):
        super().__init__(409, code, message)


class OptimizationError(CrisisError):
    def __init__(self, message: str):
        super().__init__(500, "optimization_failed", message)
