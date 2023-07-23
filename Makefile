pipeline:
	docker-compose up --wait -d
	prettier --check .
	eslint .
	npx tsc --noEmit
	npm run test:unit
	npm run test:acceptance
