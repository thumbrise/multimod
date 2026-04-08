module github.com/thumbrise/multimod/multimod

go 1.25.0

require (
	github.com/spf13/cobra v1.10.2
	golang.org/x/mod v0.34.0
)

require (
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/spf13/pflag v1.0.9 // indirect
)

replace github.com/thumbrise/multimod => ..

replace github.com/thumbrise/multimod/multirelease => ../multirelease

replace github.com/thumbrise/multimod/tools => ../_tools
