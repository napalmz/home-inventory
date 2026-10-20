import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["SECRET_KEY"] = "testsecretkey32byteslongforsecurity!"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"
os.environ["ADMIN_PASSWORD"] = "adminpassword"

import dependencies
import routes.auth
dependencies.SECRET_KEY = "testsecretkey32byteslongforsecurity!"
dependencies.ALGORITHM = "HS256"
dependencies.ACCESS_TOKEN_EXPIRE_MINUTES = 30
routes.auth.SECRET_KEY = "testsecretkey32byteslongforsecurity!"
routes.auth.ALGORITHM = "HS256"
routes.auth.ACCESS_TOKEN_EXPIRE_MINUTES = 30

from main import app
from database import Base
from dependencies import get_db, init_roles_and_admin
from models import User, Role, RoleEnum
from routes.auth import hash_password, create_access_token

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    init_roles_and_admin(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)

client = TestClient(app)

def test_blocked_user_login_fails():
    db = TestingSessionLocal()
    viewer_role = db.query(Role).filter(Role.name == RoleEnum.viewer.value).first()
    user = User(
        username="blocked_user",
        hashed_password=hash_password("password123"),
        role_id=viewer_role.id,
        is_blocked=True
    )
    db.add(user)
    db.commit()
    db.close()

    response = client.post(
        "/auth/login",
        data={"username": "blocked_user", "password": "password123"}
    )
    assert response.status_code == 403
    assert "bloccato" in response.json()["detail"].lower()

def test_blocked_user_me_returns_empty():
    db = TestingSessionLocal()
    viewer_role = db.query(Role).filter(Role.name == RoleEnum.viewer.value).first()
    user = User(
        username="blocked_user2",
        hashed_password=hash_password("password123"),
        role_id=viewer_role.id,
        is_blocked=True
    )
    db.add(user)
    db.commit()
    db.close()

    token = create_access_token({"sub": "blocked_user2"})
    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["id"] is None
    assert res_data["username"] is None

def test_admin_cannot_block_self():
    login_res = client.post(
        "/auth/login",
        data={"username": "admin", "password": "adminpassword"}
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    db = TestingSessionLocal()
    admin_user = db.query(User).filter(User.username == "admin").first()
    admin_id = admin_user.id
    db.close()

    response = client.patch(
        f"/user/users/{admin_id}/block",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 400
    assert "te stesso" in response.json()["detail"].lower()

def test_admin_can_block_other_user():
    db = TestingSessionLocal()
    viewer_role = db.query(Role).filter(Role.name == RoleEnum.viewer.value).first()
    other_user = User(
        username="normal_user",
        hashed_password=hash_password("password123"),
        role_id=viewer_role.id,
        is_blocked=False
    )
    db.add(other_user)
    db.commit()
    other_id = other_user.id
    db.close()

    login_res = client.post(
        "/auth/login",
        data={"username": "admin", "password": "adminpassword"}
    )
    token = login_res.json()["access_token"]

    response = client.patch(
        f"/user/users/{other_id}/block",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["user"]["is_blocked"] is True

def test_non_admin_cannot_block_user():
    db = TestingSessionLocal()
    viewer_role = db.query(Role).filter(Role.name == RoleEnum.viewer.value).first()
    normal_user = User(
        username="normal_user_non_admin",
        hashed_password=hash_password("password123"),
        role_id=viewer_role.id,
        is_blocked=False
    )
    target_user = User(
        username="target_user",
        hashed_password=hash_password("password123"),
        role_id=viewer_role.id,
        is_blocked=False
    )
    db.add(normal_user)
    db.add(target_user)
    db.commit()
    target_id = target_user.id
    db.close()

    token = create_access_token({"sub": "normal_user_non_admin"})
    response = client.patch(
        f"/user/users/{target_id}/block",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403
