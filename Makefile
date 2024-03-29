pipeline:
	docker-compose up --wait -d
	prettier --check .
	npx tsc --noEmit
	eslint .
	npm run test:unit
	npm run test:acceptance
