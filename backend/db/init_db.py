from .session import Base, engine
from .models import Role
from sqlalchemy.orm import declarative_base
from models.responses import Responses


Base = declarative_base()

def init_db():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init_db()



