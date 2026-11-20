# Top-level shortcuts: firmware tests, backend tests and a drill run.
.PHONY: test firmware backend drill

test: firmware backend

firmware:
	$(MAKE) -C firmware test

backend:
	cd backend && npm test

drill:
	cd backend && npm run drill
