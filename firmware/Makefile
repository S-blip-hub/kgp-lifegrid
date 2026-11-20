CXX      ?= g++
CXXFLAGS ?= -std=c++17 -Wall -Wextra -Wpedantic -O2 -Iinclude

.PHONY: test clean

test: build/test_lifenode
	./build/test_lifenode

build/test_lifenode: src/lifenode.cpp test/test_lifenode.cpp include/lifenode.hpp
	@mkdir -p build
	$(CXX) $(CXXFLAGS) src/lifenode.cpp test/test_lifenode.cpp -o $@

clean:
	rm -rf build
