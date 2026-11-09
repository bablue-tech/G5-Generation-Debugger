"""Generation diagnostics for Galleri5 AI Studio.

Read-only by design: nothing in this package writes to generations, sessions or credits.
"""

from .engine import diagnose_generation
from .resolver import Reference, ReferenceError, parse_reference
from .service import DiagnosticsService, User

__all__ = ["DiagnosticsService", "Reference", "ReferenceError", "User", "diagnose_generation", "parse_reference"]
