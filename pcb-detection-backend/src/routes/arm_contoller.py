from fastapi import APIRouter, HTTPException, Query

from ..function.arm_robot import ping_arm_robot

router = APIRouter()


@router.get("/ping")
def ping_arm_robot_route(
	path: str = Query("/", description="Path to call on arm robot"),
	timeout: int = Query(5, ge=1, le=30, description="Request timeout in seconds"),
):
	result = ping_arm_robot(path=path, timeout_seconds=timeout)
	if not result.get("ok"):
		raise HTTPException(status_code=502, detail=result)
	return result
