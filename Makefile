ifeq (,$(wildcard .env))
$(error .env file is missing at . Please create one based on .env.example)
endif

include .env	
	
build-smartguard:
	docker compose build

start-smartguard:
	docker compose up --build -d

stop-smartguard:
	docker compose stop
